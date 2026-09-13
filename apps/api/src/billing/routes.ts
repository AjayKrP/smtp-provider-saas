import { Router } from 'express';
import { z } from 'zod';
import {
  PaymentModel,
  PlanModel,
  SubscriptionModel,
  UserModel,
  isSubscriptionCurrent,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { fulfillOrder } from './fulfill.js';
import { createOrder, fetchItem, razorpayConfigured, verifyPaymentSignature } from './razorpay.js';

export const billingRouter: Router = Router();
billingRouter.use(requireAuth);

async function subscriptionView(organizationId: string) {
  const sub = await SubscriptionModel.findOne({ organizationId }).lean();
  if (!sub) {
    return { planKey: null, currentPeriodStart: null, currentPeriodEnd: null, current: false };
  }
  return {
    planKey: sub.planKey,
    currentPeriodStart: sub.currentPeriodStart ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    current: isSubscriptionCurrent(sub),
  };
}

billingRouter.get('/subscription', async (req, res) => {
  res.json(await subscriptionView(auth(req).organizationId));
});

billingRouter.get('/payments', async (req, res) => {
  const payments = await PaymentModel.find({
    organizationId: auth(req).organizationId,
    status: 'paid',
  })
    .sort({ paidAt: -1 })
    .limit(24)
    .lean();
  res.json(
    payments.map((p) => ({
      id: p._id,
      planKey: p.planKey,
      amount: p.amount,
      currency: p.currency,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
      razorpayPaymentId: p.razorpayPaymentId,
    })),
  );
});

const checkoutSchema = z.object({ planKey: z.string().min(1) });

/**
 * Create a Razorpay Order for one month of a plan. The browser opens Razorpay
 * Checkout with the returned options and posts the result to /verify.
 */
billingRouter.post('/checkout', validateBody(checkoutSchema), async (req, res) => {
  const { organizationId, userId } = auth(req);
  const { planKey } = req.body as z.infer<typeof checkoutSchema>;
  if (!razorpayConfigured) {
    throw new ApiError(503, 'Payments are not configured yet', 'unavailable');
  }

  const plan = await PlanModel.findOne({ key: planKey }).lean();
  if (!plan) throw ApiError.notFound('Unknown plan');
  if (!plan.paid) throw ApiError.badRequest('The free plan does not require payment');
  if (!plan.razorpayItemId) {
    throw ApiError.badRequest('This plan is not available for purchase yet');
  }

  // Charge the Item's live price, not the last synced copy, and refresh that copy.
  const item = await fetchItem(plan.razorpayItemId);
  if (!item.active) {
    throw ApiError.badRequest('This plan is not available for purchase right now');
  }
  await PlanModel.updateOne(
    { _id: plan._id },
    {
      $set: {
        unitAmount: item.amount,
        currency: item.currency.toLowerCase(),
        priceSyncedAt: new Date(),
      },
    },
  );

  const order = await createOrder({
    amount: item.amount,
    currency: item.currency,
    // Max 40 chars.
    receipt: `smtp_${organizationId.slice(-10)}_${Date.now()}`,
    notes: { app: 'smtp-saas', organizationId, planKey },
  });
  await PaymentModel.create({
    organizationId,
    planKey,
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency.toLowerCase(),
  });

  const user = await UserModel.findById(userId).lean();
  res.json({
    keyId: env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    planName: plan.name,
    prefill: { name: user?.name ?? '', email: user?.email ?? '' },
  });
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** Called by the browser with Razorpay Checkout's success response. */
billingRouter.post('/verify', validateBody(verifySchema), async (req, res) => {
  const { organizationId } = auth(req);
  const body = req.body as z.infer<typeof verifySchema>;

  if (
    !verifyPaymentSignature(
      body.razorpay_order_id,
      body.razorpay_payment_id,
      body.razorpay_signature,
    )
  ) {
    throw ApiError.badRequest('Payment signature verification failed');
  }
  const payment = await PaymentModel.findOne({
    razorpayOrderId: body.razorpay_order_id,
    organizationId,
  }).lean();
  if (!payment) throw ApiError.notFound('Payment not found');

  await fulfillOrder(body.razorpay_order_id, body.razorpay_payment_id);
  res.json(await subscriptionView(organizationId));
});
