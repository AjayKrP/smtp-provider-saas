import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OrganizationModel, PaymentModel, SubscriptionModel } from '@smtp-saas/shared';
import { fulfillOrder } from './fulfill.js';

let mongod: MongoMemoryServer;
let orgId: mongoose.Types.ObjectId;

const order = (id: string, planKey = 'starter') =>
  PaymentModel.create({
    organizationId: orgId,
    planKey,
    razorpayOrderId: id,
    amount: 59_900,
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
  ]);
  const org = await OrganizationModel.create({
    name: 'Acme',
    ownerUserId: new mongoose.Types.ObjectId(),
  });
  orgId = org._id;
});

describe('fulfillOrder', () => {
  it('grants one month of the plan and records the payment', async () => {
    await order('order_1');
    expect(await fulfillOrder('order_1', 'pay_1')).toBe(true);

    const [org, sub, payment] = await Promise.all([
      OrganizationModel.findById(orgId).lean(),
      SubscriptionModel.findOne({ organizationId: orgId }).lean(),
      PaymentModel.findOne({ razorpayOrderId: 'order_1' }).lean(),
    ]);
    expect(org?.planKey).toBe('starter');
    expect(sub?.status).toBe('active');
    expect(payment?.status).toBe('paid');
    expect(payment?.razorpayPaymentId).toBe('pay_1');
    expect(payment?.periodEnd?.getTime()).toBe(sub?.currentPeriodEnd?.getTime());
  });

  it('is idempotent across the checkout callback and the webhook, even concurrently', async () => {
    await order('order_1');
    await Promise.all([fulfillOrder('order_1', 'pay_1'), fulfillOrder('order_1', 'pay_1')]);
    const first = await SubscriptionModel.findOne({ organizationId: orgId }).lean();
    await fulfillOrder('order_1', 'pay_1');
    const again = await SubscriptionModel.findOne({ organizationId: orgId }).lean();
    expect(again?.currentPeriodEnd?.getTime()).toBe(first?.currentPeriodEnd?.getTime());
  });

  it('extends a running period when the same plan is renewed', async () => {
    await order('order_1');
    await order('order_2');
    await fulfillOrder('order_1', 'pay_1');
    const first = await SubscriptionModel.findOne({ organizationId: orgId }).lean();
    await fulfillOrder('order_2', 'pay_2');
    const renewed = await SubscriptionModel.findOne({ organizationId: orgId }).lean();
    expect(renewed?.currentPeriodStart?.getTime()).toBe(first?.currentPeriodEnd?.getTime());
  });

  it('ignores orders it did not create', async () => {
    expect(await fulfillOrder('order_from_another_site', 'pay_9')).toBe(false);
    expect(await SubscriptionModel.countDocuments()).toBe(0);
  });
});
