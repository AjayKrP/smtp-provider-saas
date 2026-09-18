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
let flushBackgroundMail: () => Promise<unknown>;

const ADMINS = ['boss@example.com', 'ops@example.com'];
const password = 'correct-horse-battery';

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  Object.assign(process.env, {
    MONGO_URI: replSet.getUri('admin'),
    API_PUBLIC_URL: 'http://api.test',
    DASHBOARD_URL: 'http://app.test',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
    ADMIN_EMAILS: ' Boss@Example.com, ops@example.com ,',
  });
  models = await import('@smtp-saas/shared');
  await models.connectMongo();
  await Promise.all([
    models.UserModel.init(),
    models.AuthTokenModel.init(),
    models.OrganizationModel.init(),
  ]);
  ({ flushBackgroundMail } = await import('../mail/send.js'));
  app = (await import('../app.js')).createApp();
}, 120_000);

afterAll(async () => {
  await models.disconnectMongo();
  await replSet.stop();
});

beforeEach(async () => {
  await flushBackgroundMail();
  sent.length = 0;
  await Promise.all([
    models.UserModel.deleteMany({}),
    models.OrganizationModel.deleteMany({}),
    models.AuthTokenModel.deleteMany({}),
    models.PaymentModel.deleteMany({}),
  ]);
});

/** Register, follow the verification link, and return an access token. */
async function signUp(email: string, name: string): Promise<string> {
  await request(app).post('/auth/register').send({ email, password, name }).expect(201);
  await flushBackgroundMail();
  const link = sent.filter((m) => m.to === email).at(-1)!;
  const token = decodeURIComponent(/token=([A-Za-z0-9_%-]+)/.exec(link.text)![1]!);
  const res = await request(app).post('/auth/verify-email').send({ token }).expect(200);
  await flushBackgroundMail();
  return res.body.accessToken as string;
}

describe('admin notifications', () => {
  it('emails every admin about each new signup, with the running total', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'ada@example.com', password, name: 'Ada' })
      .expect(201);
    await flushBackgroundMail();

    const notices = sent.filter((m) => m.subject.startsWith('New signup'));
    expect(notices.map((m) => m.to).sort()).toEqual(ADMINS);
    expect(notices[0]!.subject).toBe('New signup: Ada (ada@example.com)');
    expect(notices[0]!.text).toContain('Total users:  1');
    expect(notices[0]!.text).toContain('http://app.test/admin');

    // A repeat signup for the same address is not a new user.
    sent.length = 0;
    await request(app)
      .post('/auth/register')
      .send({ email: 'ada@example.com', password, name: 'Ada' })
      .expect(201);
    await flushBackgroundMail();
    expect(sent.filter((m) => m.subject.startsWith('New signup'))).toHaveLength(0);
  });

  it('emails every admin when a payment is credited, alongside the receipt', async () => {
    await signUp('ada@example.com', 'Ada');
    const user = await models.UserModel.findOne({ email: 'ada@example.com' }).lean();
    await models.PaymentModel.create({
      organizationId: user!.organizationId,
      planKey: 'starter',
      razorpayOrderId: 'order_1',
      amount: 59_900,
      currency: 'inr',
    });
    sent.length = 0;

    const { fulfillOrder } = await import('../billing/fulfill.js');
    const { onPaymentCredited } = await import('../billing/receipt.js');
    await fulfillOrder('order_1', 'pay_1', { onPaid: onPaymentCredited });
    await flushBackgroundMail();

    const notices = sent.filter((m) => m.subject.startsWith('New purchase'));
    expect(notices.map((m) => m.to).sort()).toEqual(ADMINS);
    expect(notices[0]!.subject).toContain('₹599.00');
    expect(notices[0]!.subject).toContain('ada@example.com');
    expect(notices[0]!.text).toContain('pay_1');
    expect(sent.filter((m) => m.to === 'ada@example.com')).toHaveLength(1); // the receipt
  });
});

describe('GET /admin/stats', () => {
  it('is refused to anyone not listed in ADMIN_EMAILS', async () => {
    const token = await signUp('ada@example.com', 'Ada');
    await request(app).get('/admin/stats').expect(401);
    await request(app).get('/admin/stats').set('Authorization', `Bearer ${token}`).expect(403);
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.isAdmin).toBe(false);
  });

  it('counts registered users for an admin', async () => {
    await signUp('ada@example.com', 'Ada');
    await request(app)
      .post('/auth/register')
      .send({ email: 'grace@example.com', password, name: 'Grace' })
      .expect(201);
    const token = await signUp('boss@example.com', 'Boss');

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.isAdmin).toBe(true);

    const res = await request(app)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.users).toEqual({ total: 3, verified: 2, last7Days: 3, last30Days: 3 });
    expect(res.body.recentUsers.map((u: { email: string }) => u.email)).toEqual([
      'boss@example.com',
      'grace@example.com',
      'ada@example.com',
    ]);
    expect(res.body.recentUsers[1]).toMatchObject({ verified: false, planKey: 'free' });
  });
});
