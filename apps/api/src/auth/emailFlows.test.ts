import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Express } from 'express';
import request from 'supertest';

// Capture outgoing mail instead of sending it.
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock('../mail/mailer.js', () => ({
  sendMail: vi.fn(async (mail: { to: string; subject: string; text: string }) => {
    sent.push(mail);
  }),
}));

let replSet: MongoMemoryReplSet;
let app: Express;
let models: typeof import('@smtp-saas/shared');

const linkToken = (mail: { text: string }) => {
  const match = /token=([A-Za-z0-9_%-]+)/.exec(mail.text);
  if (!match) throw new Error(`no token link in: ${mail.text}`);
  return decodeURIComponent(match[1]!);
};
const refreshCookie = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('smtp_saas_rt='))!;

const account = { email: 'Ada@Example.com', password: 'correct-horse-battery', name: 'Ada' };

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, {
    MONGO_URI: replSet.getUri('auth_flows'),
    API_PUBLIC_URL: 'http://api.test',
    DASHBOARD_URL: 'http://app.test',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
  });
  models = await import('@smtp-saas/shared');
  await models.connectMongo();
  await Promise.all([
    models.UserModel.init(),
    models.AuthTokenModel.init(),
    models.OrganizationModel.init(),
  ]);
  app = (await import('../app.js')).createApp();
}, 120_000);

afterAll(async () => {
  await models.disconnectMongo();
  await replSet.stop();
});

beforeEach(async () => {
  sent.length = 0;
  await Promise.all([
    models.UserModel.deleteMany({}),
    models.OrganizationModel.deleteMany({}),
    models.AuthTokenModel.deleteMany({}),
  ]);
});

async function registerAndVerify() {
  await request(app).post('/auth/register').send(account).expect(201);
  return request(app)
    .post('/auth/verify-email')
    .send({ token: linkToken(sent[0]!) })
    .expect(200);
}

describe('email verification', () => {
  it('registers without a session and emails a verification link', async () => {
    const res = await request(app).post('/auth/register').send(account).expect(201);
    expect(res.body).toEqual({ verificationRequired: true, email: 'ada@example.com' });
    expect(res.body.accessToken).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ada@example.com');
    expect(sent[0]!.text).toContain('http://app.test/verify-email?token=');
  });

  it('refuses login until verified, but only after a correct password', async () => {
    await request(app).post('/auth/register').send(account).expect(201);
    await request(app)
      .post('/auth/login')
      .send({ ...account, password: 'wrong-password' })
      .expect(401);
    const res = await request(app).post('/auth/login').send(account).expect(403);
    expect(res.body.error).toBe('email_not_verified');
  });

  it('verifies via the link, signs the user in, and the link is single-use', async () => {
    await request(app).post('/auth/register').send(account).expect(201);
    const token = linkToken(sent[0]!);
    const verified = await request(app).post('/auth/verify-email').send({ token }).expect(200);
    expect(verified.body.accessToken).toEqual(expect.any(String));
    await request(app).post('/auth/verify-email').send({ token }).expect(400);
    await request(app).post('/auth/login').send(account).expect(200);
  });

  it('resends only to unverified accounts, never reveals account existence, and throttles', async () => {
    await request(app).post('/auth/register').send(account).expect(201);
    const unknown = await request(app)
      .post('/auth/resend-verification')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    const throttled = await request(app)
      .post('/auth/resend-verification')
      .send({ email: account.email })
      .expect(200);
    expect(unknown.body).toEqual(throttled.body);
    expect(sent).toHaveLength(1); // within the cooldown of the registration email

    // Raw collection write: Mongoose treats createdAt as immutable.
    await models.AuthTokenModel.collection.updateMany(
      {},
      { $set: { createdAt: new Date(Date.now() - 120_000) } },
    );
    await request(app).post('/auth/resend-verification').send({ email: account.email }).expect(200);
    expect(sent).toHaveLength(2);
    // The newest link works; the older one was revoked when it was redeemed.
    await request(app)
      .post('/auth/verify-email')
      .send({ token: linkToken(sent[1]!) })
      .expect(200);
    await request(app)
      .post('/auth/verify-email')
      .send({ token: linkToken(sent[0]!) })
      .expect(400);
  });
});

describe('password reset', () => {
  it('answers identically for unknown emails and sends nothing', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('resets the password with the emailed link and signs out existing sessions', async () => {
    const session = await registerAndVerify();
    const oldCookie = refreshCookie(session);
    await request(app).post('/auth/refresh').set('Cookie', oldCookie).expect(200);

    await request(app).post('/auth/forgot-password').send({ email: account.email }).expect(200);
    const token = linkToken(sent.at(-1)!);
    expect(sent.at(-1)!.text).toContain('http://app.test/reset-password?token=');

    await request(app).post('/auth/reset-password').send({ token, password: 'short' }).expect(400);
    await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'a-brand-new-password' })
      .expect(200);
    await request(app)
      .post('/auth/reset-password')
      .send({ token, password: 'another-new-password' })
      .expect(400);

    await request(app).post('/auth/refresh').set('Cookie', oldCookie).expect(401);
    await request(app).post('/auth/login').send(account).expect(401);
    await request(app)
      .post('/auth/login')
      .send({ ...account, password: 'a-brand-new-password' })
      .expect(200);
  });

  it('rejects expired reset links', async () => {
    await registerAndVerify();
    await request(app).post('/auth/forgot-password').send({ email: account.email }).expect(200);
    await models.AuthTokenModel.updateMany(
      { purpose: 'reset_password' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await request(app)
      .post('/auth/reset-password')
      .send({ token: linkToken(sent.at(-1)!), password: 'a-brand-new-password' })
      .expect(400);
  });
});

describe('existing accounts', () => {
  it('grandfathers accounts created before verification existed, but not new ones', async () => {
    const { grandfatherVerifiedEmails } = await import('./grandfather.js');
    const orgId = new models.mongoose.Types.ObjectId();
    const createdAt = new Date('2026-09-01T00:00:00Z');
    // A pre-feature row: no emailVerifiedAt field at all.
    await models.UserModel.collection.insertOne({
      email: 'old@example.com',
      passwordHash: 'x',
      name: 'Old',
      organizationId: orgId,
      createdAt,
    });
    await request(app).post('/auth/register').send(account).expect(201);

    await grandfatherVerifiedEmails();

    const old = await models.UserModel.findOne({ email: 'old@example.com' }).lean();
    const fresh = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    expect(old?.emailVerifiedAt?.toISOString()).toBe(createdAt.toISOString());
    expect(fresh?.emailVerifiedAt).toBeNull();
  });
});
