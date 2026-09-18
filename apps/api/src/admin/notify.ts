import {
  OrganizationModel,
  PlanModel,
  UserModel,
  logger,
  planByKey,
  type PaymentDoc,
  type UserDoc,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { formatDate, formatMoney } from '../mail/format.js';
import { sendTemplate } from '../mail/send.js';
import type { EmailTemplateName, EmailTemplates } from '../mail/render.js';

export const isAdminEmail = (email: string): boolean =>
  env.ADMIN_EMAILS.includes(email.toLowerCase());

const adminUrl = () => `${env.DASHBOARD_URL}/admin`;

/** One message per admin, so a bad address can't stop the others or reveal the list. */
async function sendToAdmins<N extends EmailTemplateName>(
  name: N,
  data: EmailTemplates[N],
): Promise<void> {
  const results = await Promise.allSettled(
    env.ADMIN_EMAILS.map((to) => sendTemplate(to, name, data)),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error({ err: r.reason, to: env.ADMIN_EMAILS[i], name }, 'failed to notify admin');
    }
  });
}

/** Tell the admins someone signed up. Failures are logged, never thrown. */
export async function notifyAdminsOfSignup(user: UserDoc): Promise<void> {
  if (env.ADMIN_EMAILS.length === 0) return;
  try {
    const [org, totalUsers] = await Promise.all([
      OrganizationModel.findById(user.organizationId).lean(),
      UserModel.countDocuments(),
    ]);
    await sendToAdmins('admin-new-signup', {
      name: user.name,
      email: user.email,
      organizationName: org?.name ?? '—',
      signedUpAt: formatDate(user.get('createdAt') ?? new Date()),
      totalUsers: totalUsers.toLocaleString('en-IN'),
      adminUrl: adminUrl(),
    });
  } catch (err) {
    logger.error({ err, userId: user._id.toString() }, 'failed to send signup notice to admins');
  }
}

/** Tell the admins a payment was credited. Failures are logged, never thrown. */
export async function notifyAdminsOfPurchase(payment: PaymentDoc): Promise<void> {
  if (env.ADMIN_EMAILS.length === 0) return;
  try {
    const org = await OrganizationModel.findById(payment.organizationId).lean();
    const [owner, plan] = await Promise.all([
      org ? UserModel.findById(org.ownerUserId).lean() : null,
      PlanModel.findOne({ key: payment.planKey }).lean(),
    ]);
    await sendToAdmins('admin-purchase', {
      name: owner?.name ?? '—',
      email: owner?.email ?? '—',
      organizationName: org?.name ?? '—',
      planName: plan?.name ?? planByKey(payment.planKey)?.name ?? payment.planKey,
      amount: formatMoney(payment.amount, payment.currency),
      paidOn: formatDate(payment.paidAt ?? new Date()),
      periodEnd: payment.periodEnd ? formatDate(payment.periodEnd) : '—',
      paymentId: payment.razorpayPaymentId ?? '—',
      orderId: payment.razorpayOrderId,
      adminUrl: adminUrl(),
    });
  } catch (err) {
    logger.error(
      { err, paymentId: String(payment._id) },
      'failed to send purchase notice to admins',
    );
  }
}
