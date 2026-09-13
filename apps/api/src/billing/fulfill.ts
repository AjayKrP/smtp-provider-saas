import {
  OrganizationModel,
  PaymentModel,
  SubscriptionModel,
  logger,
  nextBillingPeriod,
} from '@smtp-saas/shared';

/**
 * Credit a paid Razorpay order: record the payment and grant (or extend) its plan
 * for one month. Idempotent — the checkout callback and the `order.paid` webhook both
 * call this for the same order, and only the first one changes anything.
 *
 * Returns false if the order is unknown to us.
 */
export async function fulfillOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<boolean> {
  const payment = await PaymentModel.findOne({ razorpayOrderId });
  if (!payment) {
    // The Razorpay account is shared with other sites, so foreign orders are expected.
    logger.debug({ razorpayOrderId }, 'razorpay order is not ours - ignoring');
    return false;
  }
  if (payment.status === 'paid') return true;

  // Claim the payment atomically so concurrent callers cannot both extend the plan.
  const claimed = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, status: 'created' },
    { $set: { status: 'paid', razorpayPaymentId, paidAt: new Date() } },
    { new: true },
  );
  if (!claimed) return true;

  const sub = await SubscriptionModel.findOne({ organizationId: claimed.organizationId }).lean();
  const { start, end } = nextBillingPeriod(sub, claimed.planKey);

  await SubscriptionModel.updateOne(
    { organizationId: claimed.organizationId },
    {
      $set: {
        planKey: claimed.planKey,
        status: 'active',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        lastPaymentId: claimed._id,
      },
    },
    { upsert: true },
  );
  await PaymentModel.updateOne(
    { _id: claimed._id },
    { $set: { periodStart: start, periodEnd: end } },
  );
  await OrganizationModel.updateOne(
    { _id: claimed.organizationId },
    { $set: { planKey: claimed.planKey } },
  );

  logger.info(
    {
      org: String(claimed.organizationId),
      planKey: claimed.planKey,
      razorpayOrderId,
      periodEnd: end,
    },
    'razorpay payment fulfilled',
  );
  return true;
}
