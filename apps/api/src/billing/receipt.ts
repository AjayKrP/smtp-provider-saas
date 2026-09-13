import {
  OrganizationModel,
  PlanModel,
  UserModel,
  logger,
  planByKey,
  type PaymentDoc,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { formatDate, formatMoney } from '../mail/format.js';
import { sendTemplate } from '../mail/send.js';

/** Email the organization owner a confirmation for a payment that was just credited. */
export async function sendPaymentReceipt(payment: PaymentDoc): Promise<void> {
  try {
    const org = await OrganizationModel.findById(payment.organizationId).lean();
    const owner = org && (await UserModel.findById(org.ownerUserId).lean());
    if (!owner) return;
    const plan = await PlanModel.findOne({ key: payment.planKey }).lean();

    await sendTemplate(owner.email, 'payment-receipt', {
      name: owner.name,
      planName: plan?.name ?? planByKey(payment.planKey)?.name ?? payment.planKey,
      amount: formatMoney(payment.amount, payment.currency),
      periodStart: payment.periodStart ? formatDate(payment.periodStart) : '—',
      periodEnd: payment.periodEnd ? formatDate(payment.periodEnd) : '—',
      paidOn: formatDate(payment.paidAt ?? new Date()),
      paymentId: payment.razorpayPaymentId ?? '—',
      orderId: payment.razorpayOrderId,
      billingUrl: `${env.DASHBOARD_URL}/billing`,
    });
  } catch (err) {
    // A receipt failure must never undo or block the payment itself.
    logger.error({ err, paymentId: String(payment._id) }, 'failed to send payment receipt');
  }
}
