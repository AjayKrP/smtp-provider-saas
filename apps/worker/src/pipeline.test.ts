import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SMTPServer } from 'smtp-server';
import type { Job } from 'bullmq';

// The worker env must exist before the modules under test are imported.
process.env.SMTP_HOSTNAME = 'mail.test.local';
process.env.BOUNCE_DOMAIN = 'bounces.test.local';

let mongod: MongoMemoryServer;
let mx: SMTPServer;
const inbox: string[] = [];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  mx = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(stream, _session, cb) {
      let data = '';
      stream.on('data', (c: Buffer) => (data += c.toString()));
      stream.on('end', () => {
        inbox.push(data);
        cb();
      });
    },
  });
  mx.listen(0);
  await once(mx.server, 'listening');
  const port = (mx.server.address() as AddressInfo).port;
  process.env.DELIVERY_MX_OVERRIDE = `127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => mx.close(() => r()));
  await mongoose.disconnect();
  await mongod.stop();
});

function fakeJob(messageId: string, organizationId: string): Job {
  return {
    data: { messageId, organizationId },
    opts: { attempts: 10 },
    attemptsMade: 0,
  } as unknown as Job;
}

describe('delivery pipeline', () => {
  it('signs, delivers, and records a message end to end', async () => {
    const shared = await import('@smtp-saas/shared');
    const { processDelivery } = await import('./processor.js');
    const {
      generateDkimKeyPair,
      encryptString,
      currentPeriod,
      OrganizationModel,
      DomainModel,
      MessageModel,
      MessageEventModel,
      UsageCounterModel,
    } = shared;

    const org = await OrganizationModel.create({
      name: 'Acme',
      ownerUserId: new mongoose.Types.ObjectId(),
      planKey: 'free',
    });

    const { privateKey, publicKey } = generateDkimKeyPair();
    await DomainModel.create({
      organizationId: org._id,
      domain: 'acme.test',
      dkimSelector: 's1',
      dkimPrivateKeyEnc: encryptString(privateKey),
      dkimPublicKey: publicKey,
      status: 'verified',
      dkimVerified: true,
    });

    const raw = Buffer.from(
      [
        'From: Acme <hello@acme.test>',
        'To: dest@remote.test',
        'Subject: Hi',
        'Message-ID: <m1@acme.test>',
        '',
        'Body text',
        '',
      ].join('\r\n'),
    );
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
      bucketName: 'raw_messages',
    });
    const rawRef = await new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
      const s = bucket.openUploadStream('<m1@acme.test>');
      s.on('error', reject);
      s.on('finish', () => resolve(s.id as mongoose.Types.ObjectId));
      s.end(raw);
    });

    const message = await MessageModel.create({
      organizationId: org._id,
      credentialId: new mongoose.Types.ObjectId(),
      messageId: '<m1@acme.test>',
      from: 'hello@acme.test',
      envelopeFrom: 'hello@acme.test',
      to: [{ address: 'dest@remote.test', status: 'queued' }],
      subject: 'Hi',
      sizeBytes: raw.length,
      status: 'queued',
      rawRef,
    });

    await processDelivery(fakeJob(message._id.toString(), org._id.toString()));

    const updated = await MessageModel.findById(message._id).lean();
    expect(updated?.status).toBe('delivered');
    expect(updated?.to[0]?.status).toBe('delivered');

    const events = await MessageEventModel.find({ messageId: message._id }).lean();
    expect(events.some((e) => e.type === 'delivered')).toBe(true);

    const counter = await UsageCounterModel.findOne({
      organizationId: org._id,
      period: currentPeriod(),
    }).lean();
    expect(counter?.delivered).toBe(1);

    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatch(/DKIM-Signature:/i);
    expect(inbox[0]).toMatch(/d=acme\.test/);
  });
});
