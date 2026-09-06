import type { Job } from 'bullmq';
import type { Types } from 'mongoose';
import {
  DomainModel,
  MessageEventModel,
  MessageModel,
  SuppressionModel,
  domainOf,
  groupByDomain,
  incrementUsage,
  logger,
  rawMessageBucket,
  type DeliveryJobData,
  type MessageDoc,
} from '@smtp-saas/shared';
import { env } from './env.js';
import { dkimSignMessage } from './dkim.js';
import { deliverToDomain, type RecipientResult } from './delivery.js';
import { sendBounce } from './bounce.js';

const NON_TERMINAL = ['queued', 'deferred', 'sending'];

function loadRaw(fileId: Types.ObjectId): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    rawMessageBucket()
      .openDownloadStream(fileId)
      .on('data', (c: Buffer) => chunks.push(c))
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function recordEvent(message: MessageDoc, res: RecipientResult): Promise<void> {
  await MessageEventModel.create({
    messageId: message._id,
    organizationId: message.organizationId,
    type: res.outcome === 'delivered' ? 'delivered' : res.outcome,
    recipient: res.address,
    mxHost: res.mxHost ?? null,
    smtpCode: res.code ?? null,
    smtpResponse: res.response ?? null,
  });
}

/** Apply a single recipient's delivery result to the message document. */
async function applyResult(
  message: MessageDoc,
  res: RecipientResult,
  opts: { suppress: boolean } = { suppress: true },
): Promise<void> {
  const recipient = message.to.find((r) => r.address === res.address);
  if (!recipient || !NON_TERMINAL.includes(recipient.status)) return;

  recipient.smtpCode = res.code ?? null;
  recipient.smtpResponse = res.response ?? null;
  recipient.mxHost = res.mxHost ?? null;

  if (res.outcome === 'delivered') {
    recipient.status = 'delivered';
    recipient.deliveredAt = new Date();
    await incrementUsage(message.organizationId, 'delivered');
  } else if (res.outcome === 'bounced') {
    recipient.status = 'bounced';
    await incrementUsage(message.organizationId, 'bounced');
    if (opts.suppress) {
      await SuppressionModel.updateOne(
        { organizationId: message.organizationId, address: res.address },
        {
          $setOnInsert: {
            organizationId: message.organizationId,
            address: res.address,
            reason: 'hard_bounce',
            smtpResponse: res.response ?? null,
          },
        },
        { upsert: true },
      );
    }
    if (message.envelopeFrom) {
      await sendBounce({
        to: message.envelopeFrom,
        originalRecipient: res.address,
        reason: res.response ?? 'permanent failure',
        messageId: message.messageId,
      });
    }
  } else {
    recipient.status = 'deferred';
  }

  await recordEvent(message, res);
}

export async function processDelivery(job: Job<DeliveryJobData>): Promise<void> {
  const message = await MessageModel.findById(job.data.messageId);
  if (!message) {
    logger.warn({ messageId: job.data.messageId }, 'delivery job for unknown message');
    return;
  }
  if (['delivered', 'bounced', 'failed'].includes(message.status)) return;

  message.status = 'sending';
  message.attempts += 1;
  await message.save();

  const fromDomain = domainOf(message.from);
  const domainDoc = fromDomain
    ? await DomainModel.findOne({ organizationId: message.organizationId, domain: fromDomain })
    : null;
  if (!domainDoc || domainDoc.status !== 'verified') {
    for (const r of message.to.filter((x) => NON_TERMINAL.includes(x.status))) {
      await applyResult(
        message,
        { address: r.address, outcome: 'bounced', response: 'sending domain no longer verified' },
        { suppress: false },
      );
    }
    message.status = 'failed';
    message.completedAt = new Date();
    message.lastError = 'sending domain no longer verified';
    await message.save();
    return;
  }

  const raw = await loadRaw(message.rawRef);
  const signed = await dkimSignMessage(raw, domainDoc);
  const bounceFrom = `${message._id.toString()}@${env.BOUNCE_DOMAIN}`;

  const pending = message.to.filter((r) => NON_TERMINAL.includes(r.status)).map((r) => r.address);
  const suppressed = await SuppressionModel.find({
    organizationId: message.organizationId,
    address: { $in: pending },
  }).lean();
  const suppressedSet = new Set(suppressed.map((s) => s.address));

  for (const address of pending.filter((a) => suppressedSet.has(a))) {
    await applyResult(
      message,
      { address, outcome: 'bounced', response: 'recipient is on your suppression list' },
      { suppress: false },
    );
  }

  const deliverable = pending.filter((a) => !suppressedSet.has(a));
  for (const [domain, recipients] of groupByDomain(deliverable)) {
    const results = await deliverToDomain({
      domain,
      recipients,
      envelopeFrom: bounceFrom,
      raw: signed,
    });
    for (const res of results) await applyResult(message, res);
  }

  await finalizeStatus(message, job);
}

async function finalizeStatus(message: MessageDoc, job: Job<DeliveryJobData>): Promise<void> {
  const statuses = message.to.map((r) => r.status);
  const deferred = statuses.filter((s) => s === 'deferred');
  const delivered = statuses.filter((s) => s === 'delivered').length;

  if (deferred.length === 0) {
    message.status = delivered > 0 ? 'delivered' : 'bounced';
    message.completedAt = new Date();
    await message.save();
    return;
  }

  const maxAttempts = job.opts.attempts ?? env.DELIVERY_MAX_ATTEMPTS;
  const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

  if (isLastAttempt) {
    for (const r of message.to.filter((x) => x.status === 'deferred')) {
      r.status = 'failed';
      await incrementUsage(message.organizationId, 'failed');
      await MessageEventModel.create({
        messageId: message._id,
        organizationId: message.organizationId,
        type: 'failed',
        recipient: r.address,
        smtpResponse: r.smtpResponse ?? 'retry limit reached',
      });
    }
    message.status = delivered > 0 ? 'delivered' : 'failed';
    message.completedAt = new Date();
    message.lastError = 'retry limit reached with recipients still deferred';
    await message.save();
    return;
  }

  message.status = 'deferred';
  await message.save();
  // Trigger BullMQ's exponential backoff retry.
  throw new Error(`${deferred.length} recipient(s) deferred; will retry`);
}
