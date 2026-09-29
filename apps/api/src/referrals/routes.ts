import { Router } from 'express';
import { z } from 'zod';
import {
  OrganizationModel,
  PayoutAccountModel,
  PayoutModel,
  ReferralCommissionModel,
  encryptString,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { validateBody } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { ensureReferralCode } from './commissions.js';
import { earningsFor, requestPayout } from './payouts.js';

export const referralsRouter: Router = Router();
referralsRouter.use(requireAuth);

/**
 * A bank account number is 9–18 digits in India, and an IFSC is four letters, a zero,
 * then six alphanumerics. Both are checked here so an obvious typo is caught while the
 * customer is still looking at the form, rather than days later when a transfer bounces.
 */
const accountSchema = z.object({
  holderName: z.string().trim().min(2).max(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, 'Enter the account number, digits only'),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'That does not look like an IFSC code'),
  bankName: z.string().trim().max(120).optional(),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'That does not look like a PAN'),
});

referralsRouter.get('/', async (req, res) => {
  const { organizationId } = auth(req);

  const [code, summary, referredCount, payingCount, account, payouts, commissions] =
    await Promise.all([
      ensureReferralCode(organizationId),
      earningsFor(organizationId),
      OrganizationModel.countDocuments({ referredByOrganizationId: organizationId }),
      ReferralCommissionModel.distinct('refereeOrganizationId', {
        referrerOrganizationId: organizationId,
      }).then((ids) => ids.length),
      PayoutAccountModel.findOne({ organizationId }).lean(),
      PayoutModel.find({ organizationId }).sort({ requestedAt: -1 }).limit(12).lean(),
      ReferralCommissionModel.find({ referrerOrganizationId: organizationId })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
    ]);

  res.json({
    code,
    shareUrl: `${env.DASHBOARD_URL}/r/${code}`,
    terms: {
      percent: env.REFERRAL_COMMISSION_PERCENT,
      holdDays: env.REFERRAL_HOLD_DAYS,
      minimumPayout: env.REFERRAL_MIN_PAYOUT,
      withholdingPercent: env.REFERRAL_TDS_PERCENT,
      currency: 'INR',
    },
    stats: { referred: referredCount, paying: payingCount },
    earnings: summary,
    // Never the encrypted values, and never the full account number: only enough for the
    // customer to recognise which account is on file.
    payoutAccount: account
      ? {
          holderName: account.holderName,
          accountNumberLast4: account.accountNumberLast4,
          ifsc: account.ifsc,
          bankName: account.bankName,
          panLast4: account.panLast4,
          confirmedAt: account.confirmedAt,
        }
      : null,
    payouts: payouts.map((p) => ({
      id: p._id,
      grossAmount: p.grossAmount,
      withheldAmount: p.withheldAmount,
      netAmount: p.netAmount,
      currency: p.currency,
      status: p.status,
      failureReason: p.failureReason,
      requestedAt: p.requestedAt,
      settledAt: p.settledAt,
    })),
    commissions: commissions.map((c) => ({
      id: c._id,
      amount: c.amount,
      currency: c.currency,
      percent: c.percent,
      status: c.status,
      availableAt: c.availableAt,
      createdAt: c.createdAt,
    })),
  });
});

referralsRouter.put('/payout-account', validateBody(accountSchema), async (req, res) => {
  const { organizationId } = auth(req);
  const body = req.body as z.infer<typeof accountSchema>;

  await PayoutAccountModel.updateOne(
    { organizationId },
    {
      $set: {
        holderName: body.holderName,
        accountNumberEncrypted: encryptString(body.accountNumber),
        accountNumberLast4: body.accountNumber.slice(-4),
        ifsc: body.ifsc,
        bankName: body.bankName ?? null,
        panEncrypted: encryptString(body.pan),
        panLast4: body.pan.slice(-4),
        // Details changed: the next successful transfer re-confirms them.
        confirmedAt: null,
      },
      $setOnInsert: { organizationId },
    },
    { upsert: true },
  );

  res.status(204).end();
});

referralsRouter.post('/payouts', async (req, res) => {
  const payout = await requestPayout(auth(req).organizationId);
  res.status(201).json({
    id: payout._id,
    grossAmount: payout.grossAmount,
    withheldAmount: payout.withheldAmount,
    netAmount: payout.netAmount,
    currency: payout.currency,
    status: payout.status,
    requestedAt: payout.requestedAt,
  });
});
