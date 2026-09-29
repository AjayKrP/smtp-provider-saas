import {
  OrganizationModel,
  PaymentModel,
  SubscriptionModel,
  logger,
  nextBillingPeriod,
  type PaymentDoc,
} from '@smtp-saas/shared';
import { awardReferralCommission } from '../referrals/commissions.js';

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
  opts: { onPaid?: (payment: PaymentDoc) => Promise<void> } = {},
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
  claimed.periodStart = start;
  claimed.periodEnd = end;
  await OrganizationModel.updateOne(
    { _id: claimed.organizationId },
    { $set: { planKey: claimed.planKey } },
  );

  // Inside fulfillOrder rather than in an onPaid hook: this runs for whichever caller
  // claimed the payment, so a referrer is paid exactly once whether the checkout callback
  // or the webhook got here first. A failure here must not unwind a credited plan, so it
  // is logged and left for the operator rather than thrown.
  try {
    await awardReferralCommission(claimed);
  } catch (err) {
    logger.error(
      { err, payment: String(claimed._id) },
      'could not award referral commission for a fulfilled payment',
    );
  }

  logger.info(
    {
      org: String(claimed.organizationId),
      planKey: claimed.planKey,
      razorpayOrderId,
      periodEnd: end,
    },
    'razorpay payment fulfilled',
  );
  // Runs only for the caller that actually claimed the payment, so at most once.
  await opts.onPaid?.(claimed);
  return true;
}
