import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.SMTP_HOSTNAME ??= 'mail.test.local';
process.env.BOUNCE_DOMAIN ??= 'bounces.test.local';

let mongod: MongoMemoryServer;
let shared: typeof import('@smtp-saas/shared');
let runRetention: typeof import('./retention.js').runRetention;

const now = new Date('2026-09-30T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60_000);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  shared = await import('@smtp-saas/shared');
  ({ runRetention } = await import('./retention.js'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    shared.MessageModel.deleteMany({}),
    shared.MessageEventModel.deleteMany({}),
    mongoose.connection.db!.collection('raw_messages.files').deleteMany({}),
    mongoose.connection.db!.collection('raw_messages.chunks').deleteMany({}),
  ]);
});

async function message(ageDays: number, status = 'delivered') {
  const bucket = shared.rawMessageBucket();
  const rawRef = await new Promise<mongoose.Types.ObjectId>((resolve, reject) => {
    const up = bucket.openUploadStream('m');
    up.on('error', reject);
    up.on('finish', () => resolve(up.id as mongoose.Types.ObjectId));
    up.end(Buffer.from('From: a@b.test\r\n\r\nsecret body'));
  });
  const created = daysAgo(ageDays);
  const doc = await shared.MessageModel.collection.insertOne({
    organizationId: new mongoose.Types.ObjectId(),
    credentialId: new mongoose.Types.ObjectId(),
    messageId: `<${ageDays}@b.test>`,
    from: 'a@b.test',
    envelopeFrom: 'x@bounces.test',
    to: [{ address: 'c@d.test', status }],
    subject: 's',
    sizeBytes: 10,
    status,
    attempts: 1,
    rawRef,
    rawDeletedAt: null,
    createdAt: created,
    updatedAt: created,
  });
  await shared.MessageEventModel.create({
    messageId: doc.insertedId,
    organizationId: new mongoose.Types.ObjectId(),
    type: 'queued',
    at: created,
  });
  return { id: doc.insertedId, rawRef };
}

const rawExists = async (id: mongoose.Types.ObjectId) =>
  (await mongoose.connection.db!.collection('raw_messages.files').countDocuments({ _id: id })) > 0;

describe('runRetention', () => {
  it('keeps recent messages untouched', async () => {
    const fresh = await message(2);
    expect(await runRetention(now)).toEqual({ contentDeleted: 0, recordsDeleted: 0 });
    expect(await rawExists(fresh.rawRef)).toBe(true);
  });

  it('deletes content after 7 days but keeps the Activity record until 30 days', async () => {
    const week = await message(8);
    const month = await message(31);

    expect(await runRetention(now)).toEqual({ contentDeleted: 2, recordsDeleted: 1 });

    expect(await rawExists(week.rawRef)).toBe(false);
    const kept = await shared.MessageModel.findById(week.id).lean();
    expect(kept?.rawDeletedAt?.toISOString()).toBe(now.toISOString());
    expect(kept?.status).toBe('delivered');
    expect(await shared.MessageEventModel.countDocuments({ messageId: week.id })).toBe(1);

    expect(await rawExists(month.rawRef)).toBe(false);
    expect(await shared.MessageModel.findById(month.id).lean()).toBeNull();
    expect(await shared.MessageEventModel.countDocuments({ messageId: month.id })).toBe(0);
  });

  it('marks a message that never finished as failed before deleting its content', async () => {
    const stuck = await message(9, 'deferred');
    await runRetention(now);
    const doc = await shared.MessageModel.findById(stuck.id).lean();
    expect(doc?.status).toBe('failed');
    expect(doc?.lastError).toMatch(/not delivered within 7 days/);
  });

  it('is idempotent, including when content was already deleted', async () => {
    await message(8);
    await runRetention(now);
    expect(await runRetention(now)).toEqual({ contentDeleted: 0, recordsDeleted: 0 });
  });
});
