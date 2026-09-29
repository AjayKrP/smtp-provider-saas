import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  OrganizationModel,
  PaymentModel,
  ReferralCommissionModel,
  SubscriptionModel,
} from '@smtp-saas/shared';
import { fulfillOrder } from '../billing/fulfill.js';
import {
  ensureReferralCode,
  referrerForCode,
  reverseCommissionsForPayment,
} from './commissions.js';

let mongod: MongoMemoryServer;
let referrer: mongoose.Types.ObjectId;
let referee: mongoose.Types.ObjectId;

const org = (name: string) =>
  OrganizationModel.create({ name, ownerUserId: new mongoose.Types.ObjectId() });

const order = (id: string, organizationId: mongoose.Types.ObjectId, amount = 59_900) =>
  PaymentModel.create({
    organizationId,
    planKey: 'starter',
    razorpayOrderId: id,
    amount,
    currency: 'inr',
  });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    OrganizationModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    SubscriptionModel.deleteMany({}),
    ReferralCommissionModel.deleteMany({}),
  ]);
  referrer = (await org('Referrer'))._id;
  referee = (await org('Referee'))._id;
  await OrganizationModel.updateOne(
    { _id: referee },
    { $set: { referredByOrganizationId: referrer, referredAt: new Date() } },
  );
});

describe('awardReferralCommission, through fulfillOrder', () => {
  it('credits the referrer 10% when a referred organization pays', async () => {
    await order('order_1', referee);
    await fulfillOrder('order_1', 'pay_1');

    const commission = await ReferralCommissionModel.findOne({
      referrerOrganizationId: referrer,
    }).lean();
    expect(commission).toMatchObject({
      amount: 5_990,
      grossAmount: 59_900,
      percent: 10,
      currency: 'INR',
      status: 'pending',
    });
  });

  it('holds the commission before it can be withdrawn', async () => {
    await order('order_1', referee);
    await fulfillOrder('order_1', 'pay_1');

    const commission = await ReferralCommissionModel.findOne({}).lean();
    expect(commission!.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('pays only once when the callback and the webhook both fulfil the same order', async () => {
    await order('order_1', referee);
    await Promise.all([fulfillOrder('order_1', 'pay_1'), fulfillOrder('order_1', 'pay_1')]);
    await fulfillOrder('order_1', 'pay_1');

    expect(await ReferralCommissionModel.countDocuments({})).toBe(1);
  });

  it('keeps paying on every later purchase, not just the first', async () => {
    await order('order_1', referee);
    await fulfillOrder('order_1', 'pay_1');
    await order('order_2', referee, 100_000);
    await fulfillOrder('order_2', 'pay_2');

    const commissions = await ReferralCommissionModel.find({}).sort({ amount: 1 }).lean();
    expect(commissions.map((c) => c.amount)).toEqual([5_990, 10_000]);
  });

  it('awards nothing when the paying organization was never referred', async () => {
    const stranger = (await org('Stranger'))._id;
    await order('order_1', stranger);
    await fulfillOrder('order_1', 'pay_1');

    expect(await ReferralCommissionModel.countDocuments({})).toBe(0);
  });

  it('awards nothing on a self-referral', async () => {
    const selfReferrer = (await org('Solo'))._id;
    await OrganizationModel.updateOne(
      { _id: selfReferrer },
      { $set: { referredByOrganizationId: selfReferrer } },
    );
    await order('order_1', selfReferrer);
    await fulfillOrder('order_1', 'pay_1');

    expect(await ReferralCommissionModel.countDocuments({})).toBe(0);
  });
});

describe('reverseCommissionsForPayment', () => {
  it('takes back a commission whose payment was refunded', async () => {
    await order('order_1', referee);
    await fulfillOrder('order_1', 'pay_1');

    await reverseCommissionsForPayment('pay_1', 'razorpay refund.created');

    const commission = await ReferralCommissionModel.findOne({}).lean();
    expect(commission).toMatchObject({
      status: 'reversed',
      reversalReason: 'razorpay refund.created',
    });
    expect(commission!.reversedAt).toBeInstanceOf(Date);
  });

  it('leaves an already-paid commission alone, for recovery by hand', async () => {
    await order('order_1', referee);
    await fulfillOrder('order_1', 'pay_1');
    await ReferralCommissionModel.updateMany({}, { $set: { status: 'paid' } });

    await reverseCommissionsForPayment('pay_1', 'razorpay refund.created');

    expect((await ReferralCommissionModel.findOne({}).lean())!.status).toBe('paid');
  });

  it('ignores a refund for a payment we never recorded', async () => {
    await expect(reverseCommissionsForPayment('pay_unknown', 'refund')).resolves.toBeUndefined();
  });
});

describe('referral codes', () => {
  it('mints one code and returns the same one afterwards', async () => {
    const first = await ensureReferralCode(String(referrer));
    const second = await ensureReferralCode(String(referrer));
    expect(second).toBe(first);
    expect(first).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('resolves a code back to its organization, however it is typed', async () => {
    const code = await ensureReferralCode(String(referrer));
    expect(await referrerForCode(code.toLowerCase())).toBe(String(referrer));
    expect(await referrerForCode(`https://example.com/r/${code}`)).toBe(String(referrer));
  });

  it('resolves an unknown or malformed code to nobody', async () => {
    expect(await referrerForCode('ACDEFGHJ')).toBeNull();
    expect(await referrerForCode('nonsense')).toBeNull();
  });
});
