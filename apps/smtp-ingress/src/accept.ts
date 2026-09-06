import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { simpleParser } from 'mailparser';
import type { SMTPServerSession } from 'smtp-server';
import {
  DomainModel,
  MessageEventModel,
  MessageModel,
  domainOf,
  extractAddress,
  getEffectivePlan,
  getQuotaSnapshot,
  logger,
  rawMessageBucket,
  reserveQuota,
} from '@smtp-saas/shared';
import type { DeliveryJobData } from '@smtp-saas/shared';
import type { AuthedCredential } from './auth.js';
import { env } from './env.js';
import { allowRate } from './ratelimit.js';

export type EnqueueFn = (data: DeliveryJobData) => Promise<void>;

export class SmtpError extends Error {
  constructor(
    public responseCode: number,
    message: string,
  ) {
    super(message);
  }
}

async function readToBuffer(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > maxBytes) throw new SmtpError(552, 'Message exceeds maximum allowed size');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function storeRaw(messageId: string, raw: Buffer): Promise<import('mongoose').Types.ObjectId> {
  return new Promise((resolve, reject) => {
    const upload = rawMessageBucket().openUploadStream(messageId);
    upload.on('error', reject);
    upload.on('finish', () => resolve(upload.id as import('mongoose').Types.ObjectId));
    upload.end(raw);
  });
}

/** Handle a fully-received DATA stream: validate, persist, enqueue. */
export async function acceptMessage(
  stream: Readable,
  session: SMTPServerSession,
  enqueue: EnqueueFn,
): Promise<string> {
  const user = session.user as unknown as AuthedCredential | undefined;
  if (!user) throw new SmtpError(530, 'Authentication required');

  const raw = await readToBuffer(stream, env.SMTP_MAX_MESSAGE_BYTES);
  const parsed = await simpleParser(raw);

  const fromHeader = parsed.from?.text ?? '';
  const fromAddress = extractAddress(fromHeader);
  if (!fromAddress) throw new SmtpError(550, 'A valid From header is required');
  const fromDomain = domainOf(fromAddress);
  if (!fromDomain) throw new SmtpError(550, 'Could not parse the From domain');

  const [plan, quota, verifiedDomain] = await Promise.all([
    getEffectivePlan(user.organizationId),
    getQuotaSnapshot(user.organizationId),
    DomainModel.findOne({
      organizationId: user.organizationId,
      domain: fromDomain,
      status: 'verified',
    }).lean(),
  ]);

  if (!verifiedDomain) {
    throw new SmtpError(550, `${fromDomain} is not a verified sending domain for your account`);
  }
  if (!quota.subscriptionActive) {
    throw new SmtpError(550, 'Your subscription is not active; update billing to resume sending');
  }

  const recipients = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
  if (recipients.length === 0) throw new SmtpError(554, 'No recipients');
  if (recipients.length > plan.maxRecipientsPerMessage) {
    throw new SmtpError(452, `Too many recipients (max ${plan.maxRecipientsPerMessage} per message)`);
  }

  const perMinuteCap = Math.max(60, Math.ceil(plan.monthlyEmailQuota / 1000));
  if (!(await allowRate(`org:${user.organizationId}`, perMinuteCap))) {
    throw new SmtpError(451, 'Sending rate limit reached; retry shortly');
  }

  const reserved = await reserveQuota(user.organizationId, plan.monthlyEmailQuota, recipients.length);
  if (!reserved) {
    throw new SmtpError(452, `Monthly send quota of ${plan.monthlyEmailQuota} reached`);
  }

  const messageId =
    parsed.messageId ?? `<${randomUUID()}@${env.SMTP_HOSTNAME}>`;
  const envelopeFrom = session.envelope.mailFrom ? session.envelope.mailFrom.address : fromAddress;

  const rawRef = await storeRaw(messageId, raw);
  const message = await MessageModel.create({
    organizationId: user.organizationId,
    credentialId: user.credentialId,
    messageId,
    from: fromAddress,
    envelopeFrom,
    to: recipients.map((address) => ({ address, status: 'queued' })),
    subject: parsed.subject ?? '',
    sizeBytes: raw.length,
    status: 'queued',
    rawRef,
  });

  await Promise.all([
    MessageEventModel.create({
      messageId: message._id,
      organizationId: user.organizationId,
      type: 'queued',
    }),
    enqueue({ messageId: message._id.toString(), organizationId: user.organizationId }),
  ]);

  logger.info(
    { org: user.organizationId, messageId, recipients: recipients.length },
    'message accepted',
  );
  return message._id.toString();
}
