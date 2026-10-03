import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Express } from 'express';
import request from 'supertest';

// Outgoing mail is captured rather than sent: a Google signup should send no
// verification email at all, which is one of the things asserted below.
const sent: { to: string; subject: string }[] = [];
vi.mock('../mail/mailer.js', () => ({
  sendMail: vi.fn(async (mail: { to: string; subject: string }) => {
    sent.push(mail);
  }),
}));

/**
 * Google's own verification is stubbed: what matters here is what we do with a verified
 * identity, not that google-auth-library can check a signature. The stub stands in for a
 * credential that has already been validated, so every test below is about our linking
 * and account-creation rules.
 */
const identity = {
  sub: 'google-sub-1',
  email: 'ada@example.com',
  emailVerified: true,
  name: 'Ada Lovelace',
};
let nextIdentity = { ...identity };
vi.mock('./google.js', () => ({
  googleSignInConfigured: true,
  verifyGoogleCredential: vi.fn(async () => nextIdentity),
}));

let replSet: MongoMemoryReplSet;
let app: Express;
let models: typeof import('@smtp-saas/shared');

const signInWithGoogle = (body: Record<string, unknown> = {}) =>
  request(app)
    .post('/auth/google')
    .send({ credential: 'stub-credential', ...body });

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, {
    MONGO_URI: replSet.getUri('google_auth'),
    API_PUBLIC_URL: 'http://api.test',
    DASHBOARD_URL: 'http://app.test',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  });
  models = await import('@smtp-saas/shared');
  await models.connectMongo();
  await Promise.all([models.UserModel.init(), models.OrganizationModel.init()]);
  app = (await import('../app.js')).createApp();
}, 120_000);

afterAll(async () => {
  await models.disconnectMongo();
  await replSet.stop();
});

beforeEach(async () => {
  sent.length = 0;
  nextIdentity = { ...identity };
  await Promise.all([models.UserModel.deleteMany({}), models.OrganizationModel.deleteMany({})]);
});

describe('POST /auth/google', () => {
  it('creates an account, an organization and a session on first sign-in', async () => {
    const res = await signInWithGoogle();

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();

    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    expect(user).toMatchObject({ googleSub: 'google-sub-1', name: 'Ada Lovelace' });
    const org = await models.OrganizationModel.findById(user!.organizationId).lean();
    expect(org?.ownerUserId.toString()).toBe(user!._id.toString());
  });

  it('skips email verification entirely, because Google already vouched for it', async () => {
    await signInWithGoogle();

    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    expect(user!.emailVerifiedAt).toBeInstanceOf(Date);
    // No verification link is sent — the signup notification to operators is not one.
    expect(sent.filter((m) => m.to === 'ada@example.com')).toHaveLength(0);
  });

  it('creates no password hash for a Google-only account', async () => {
    await signInWithGoogle();

    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    expect(user!.passwordHash).toBeNull();
  });

  it('signs the same person in again without creating a second account', async () => {
    await signInWithGoogle();
    const res = await signInWithGoogle();

    expect(res.status).toBe(200);
    expect(await models.UserModel.countDocuments({})).toBe(1);
    expect(await models.OrganizationModel.countDocuments({})).toBe(1);
  });

  it('links an existing password account when Google has verified the address', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'ada@example.com', password: 'correct-horse-battery', name: 'Ada' })
      .expect(201);

    const res = await signInWithGoogle();

    expect(res.status).toBe(200);
    expect(await models.UserModel.countDocuments({})).toBe(1);
    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    expect(user!.googleSub).toBe('google-sub-1');
    // The password still works: linking adds a way in, it does not take one away.
    expect(user!.passwordHash).toBeTruthy();
  });

  it('verifies a linked account that was stuck unverified', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'ada@example.com', password: 'correct-horse-battery', name: 'Ada' })
      .expect(201);
    expect((await models.UserModel.findOne({}).lean())!.emailVerifiedAt).toBeNull();

    await signInWithGoogle();

    // Someone whose verification email landed in spam gets in this way.
    expect((await models.UserModel.findOne({}).lean())!.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('refuses to link an existing account on an unverified Google address', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'ada@example.com', password: 'correct-horse-battery', name: 'Ada' })
      .expect(201);
    nextIdentity = { ...identity, emailVerified: false };

    const res = await signInWithGoogle();

    // The takeover this endpoint has to refuse: anyone who can get Google to issue a
    // token claiming an address must not thereby acquire the account using it.
    expect(res.status).toBe(403);
    const user = await models.UserModel.findOne({}).lean();
    expect(user!.googleSub).toBeNull();
  });

  it('refuses to create an account on an unverified Google address', async () => {
    nextIdentity = { ...identity, emailVerified: false };

    const res = await signInWithGoogle();

    expect(res.status).toBe(403);
    expect(await models.UserModel.countDocuments({})).toBe(0);
  });

  it('attributes a referral code given at sign-in', async () => {
    const referrer = await models.OrganizationModel.create({
      name: 'Referrer',
      ownerUserId: new models.mongoose.Types.ObjectId(),
      referralCode: 'ACDEFGHJ',
    });

    await signInWithGoogle({ referralCode: 'acdefghj' });

    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    const org = await models.OrganizationModel.findById(user!.organizationId).lean();
    expect(String(org!.referredByOrganizationId)).toBe(String(referrer._id));
  });

  it('rejects a request with no credential', async () => {
    await request(app).post('/auth/google').send({}).expect(400);
  });
});
