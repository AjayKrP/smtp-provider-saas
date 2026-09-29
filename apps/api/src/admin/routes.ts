import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  OrganizationModel,
  PaymentModel,
  PayoutModel,
  SubscriptionModel,
  UserModel,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { razorpayxConfigured } from '../billing/razorpayx.js';
import { failPayout, sendPayout, settlePayoutManually } from '../referrals/payouts.js';
import { isAdminEmail } from './notify.js';

export const adminRouter: Router = Router();

/** Only verified accounts whose email is listed in ADMIN_EMAILS. */
async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = await UserModel.findById(auth(req).userId, { email: 1, emailVerifiedAt: 1 }).lean();
  if (!user?.emailVerifiedAt || !isAdminEmail(user.email)) throw ApiError.forbidden();
  next();
}

adminRouter.use(requireAuth, requireAdmin);

const DAY = 24 * 60 * 60_000;

adminRouter.get('/stats', async (_req, res) => {
  const now = Date.now();
  const since = (days: number) => ({ createdAt: { $gte: new Date(now - days * DAY) } });

  const [total, verified, last7Days, last30Days, activePaid, revenue, recentUsers, recentPayments] =
    await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ emailVerifiedAt: { $ne: null } }),
      UserModel.countDocuments(since(7)),
      UserModel.countDocuments(since(30)),
      SubscriptionModel.countDocuments({
        lifetime: { $ne: true },
        currentPeriodEnd: { $gt: new Date(now) },
      }),
      PaymentModel.aggregate<{ _id: string; amount: number; count: number }>([
        { $match: { status: 'paid' } },
        { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]),
      UserModel.find({}, { email: 1, name: 1, organizationId: 1, emailVerifiedAt: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      PaymentModel.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(20).lean(),
    ]);

  const orgIds = [
    ...new Set([
      ...recentUsers.map((u) => String(u.organizationId)),
      ...recentPayments.map((p) => String(p.organizationId)),
    ]),
  ];
  const orgs = await OrganizationModel.find({ _id: { $in: orgIds } }).lean();
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));
  const owners = await UserModel.find(
    { _id: { $in: orgs.map((o) => o.ownerUserId) } },
    { email: 1 },
  ).lean();
  const ownerEmail = new Map(owners.map((u) => [String(u._id), u.email]));

  res.json({
    users: { total, verified, last7Days, last30Days },
    activePaidSubscriptions: activePaid,
    revenue: revenue.map((r) => ({ currency: r._id, amount: r.amount, payments: r.count })),
    recentUsers: recentUsers.map((u) => {
      const org = orgById.get(String(u.organizationId));
      return {
        id: u._id,
        email: u.email,
        name: u.name,
        verified: !!u.emailVerifiedAt,
        organizationName: org?.name ?? null,
        planKey: org?.planKey ?? null,
        createdAt: u.createdAt,
      };
    }),
    recentPayments: recentPayments.map((p) => {
      const org = orgById.get(String(p.organizationId));
      return {
        id: p._id,
        email: org ? (ownerEmail.get(String(org.ownerUserId)) ?? null) : null,
        organizationName: org?.name ?? null,
        planKey: p.planKey,
        amount: p.amount,
        currency: p.currency,
        paidAt: p.paidAt,
      };
    }),
  });
});

/**
 * The payout queue: every referral payout an operator still has to act on, oldest first.
 *
 * Payouts are deliberately not automatic. Money leaving the account on a schedule nobody
 * watches is how a referral program funds a fraud ring, so a person approves each one.
 */
adminRouter.get('/payouts', async (_req, res) => {
  const payouts = await PayoutModel.find({
    status: { $in: ['requested', 'approved', 'processing', 'failed'] },
  })
    .sort({ requestedAt: 1 })
    .limit(100)
    .lean();

  const orgIds = payouts.map((p) => p.organizationId);
  const orgs = await OrganizationModel.find(
    { _id: { $in: orgIds } },
    { name: 1, ownerUserId: 1 },
  ).lean();
  const owners = await UserModel.find(
    { _id: { $in: orgs.map((o) => o.ownerUserId) } },
    { email: 1 },
  ).lean();
  const emailByUser = new Map(owners.map((u) => [String(u._id), u.email]));
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  res.json({
    transfersAvailable: razorpayxConfigured,
    withholdingPercent: env.REFERRAL_TDS_PERCENT,
    payouts: payouts.map((p) => {
      const org = orgById.get(String(p.organizationId));
      return {
        id: p._id,
        organizationName: org?.name ?? null,
        email: org ? (emailByUser.get(String(org.ownerUserId)) ?? null) : null,
        grossAmount: p.grossAmount,
        withheldAmount: p.withheldAmount,
        netAmount: p.netAmount,
        currency: p.currency,
        status: p.status,
        destination: p.destination,
        failureReason: p.failureReason,
        requestedAt: p.requestedAt,
      };
    }),
  });
});

const payoutActionSchema = z.object({
  action: z.enum(['send', 'settle', 'fail']),
  /** Required for `settle`: the UPI/NEFT reference of the transfer already made. */
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(200).optional(),
});

adminRouter.post('/payouts/:id', validateBody(payoutActionSchema), async (req, res) => {
  const body = req.body as z.infer<typeof payoutActionSchema>;
  if (!Types.ObjectId.isValid(String(req.params.id))) throw ApiError.notFound('Payout not found');
  const payout = await PayoutModel.findById(req.params.id);
  if (!payout) throw ApiError.notFound('Payout not found');
  if (payout.status === 'paid') throw ApiError.conflict('That payout has already been paid');

  if (body.action === 'send') {
    await sendPayout(payout);
  } else if (body.action === 'settle') {
    if (!body.reference) throw ApiError.badRequest('Record the transfer reference');
    await settlePayoutManually(payout, body.reference);
  } else {
    await failPayout(payout, body.reason ?? 'rejected by an operator');
  }

  res.json({ id: payout._id, status: payout.status });
});
