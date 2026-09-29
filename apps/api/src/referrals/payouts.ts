import { Types } from 'mongoose';
import {
  PayoutAccountModel,
  PayoutModel,
  ReferralCommissionModel,
  UserModel,
  checkPayoutEligible,
  decryptString,
  logger,
  summarizeEarnings,
  withholdingFor,
  type EarningsSummary,
  type PayoutDoc,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { ApiError } from '../http/errors.js';
import { createRazorpayxPayout, razorpayxConfigured } from '../billing/razorpayx.js';

/** Statuses a payout can still change from; used to stop a second concurrent request. */
const OPEN_PAYOUT_STATUSES = ['requested', 'approved', 'processing'];

export async function earningsFor(organizationId: string): Promise<EarningsSummary> {
  const rows = await ReferralCommissionModel.find(
    { referrerOrganizationId: organizationId },
    { status: 1, amount: 1, currency: 1, availableAt: 1 },
  ).lean();
  return summarizeEarnings(rows);
}

/**
 * Turn a referrer's withdrawable balance into a payout request.
 *
 * The commissions are claimed in one atomic update before the payout is written, so two
 * simultaneous requests cannot both take the same earnings: the second one finds nothing
 * left to claim. If writing the payout then fails, the claim is released rather than
 * leaving money stranded in a payout that does not exist.
 */
export async function requestPayout(organizationId: string): Promise<PayoutDoc> {
  const [summary, account, openPayout, owner] = await Promise.all([
    earningsFor(organizationId),
    PayoutAccountModel.findOne({ organizationId }).lean(),
    PayoutModel.exists({ organizationId, status: { $in: OPEN_PAYOUT_STATUSES } }),
    UserModel.findOne({ organizationId }, { emailVerifiedAt: 1 }).lean(),
  ]);

  const eligible = checkPayoutEligible({
    available: summary.available,
    currency: summary.currency,
    minimum: env.REFERRAL_MIN_PAYOUT,
    hasPayoutAccount: !!account,
    hasTaxId: !!account?.panEncrypted,
    emailVerified: !!owner?.emailVerifiedAt,
    openPayout: !!openPayout,
  });
  if (!eligible.ok) throw ApiError.badRequest(eligible.reason ?? 'Payout is not available yet');

  const payoutId = new Types.ObjectId();
  const now = new Date();

  // Claim first, then write the payout that owns the claim.
  const claim = await ReferralCommissionModel.updateMany(
    {
      referrerOrganizationId: organizationId,
      status: { $in: ['pending', 'available'] },
      availableAt: { $lte: now },
      payoutId: null,
    },
    { $set: { status: 'claimed', payoutId } },
  );
  if (claim.modifiedCount === 0) throw ApiError.badRequest('Nothing available to pay out');

  const claimed = await ReferralCommissionModel.find(
    { payoutId },
    { amount: 1, currency: 1 },
  ).lean();
  const gross = claimed.reduce((sum, row) => sum + row.amount, 0);
  const withheld = withholdingFor(gross, env.REFERRAL_TDS_PERCENT);

  try {
    const [payout] = await PayoutModel.create([
      {
        _id: payoutId,
        organizationId,
        grossAmount: gross,
        withheldAmount: withheld,
        withheldPercent: env.REFERRAL_TDS_PERCENT,
        netAmount: gross - withheld,
        currency: claimed[0]?.currency ?? 'INR',
        status: 'requested',
        destination: {
          holderName: account?.holderName ?? null,
          accountNumberLast4: account?.accountNumberLast4 ?? null,
          ifsc: account?.ifsc ?? null,
        },
        requestedAt: now,
      },
    ]);
    logger.info(
      { org: organizationId, payout: String(payoutId), gross, net: gross - withheld },
      'referral payout requested',
    );
    return payout!;
  } catch (err) {
    await releaseClaim(payoutId);
    throw err;
  }
}

/** Put claimed commissions back in the pool. Used when a payout fails or is cancelled. */
async function releaseClaim(payoutId: unknown): Promise<void> {
  await ReferralCommissionModel.updateMany(
    { payoutId, status: 'claimed' },
    { $set: { status: 'available', payoutId: null } },
  );
}

/**
 * Attempt the transfer through RazorpayX.
 *
 * Without RazorpayX credentials this is a no-op that leaves the payout `requested` for an
 * operator to settle by hand and record with `settlePayoutManually` — which is a perfectly
 * good way to run a referral program until the volume justifies the integration.
 */
export async function sendPayout(payout: PayoutDoc): Promise<PayoutDoc> {
  if (!razorpayxConfigured) {
    throw ApiError.badRequest(
      'RazorpayX is not configured on this server. Settle this payout manually and record the reference.',
    );
  }

  const account = await PayoutAccountModel.findOne({ organizationId: payout.organizationId });
  if (!account) throw ApiError.badRequest('The payout account has been removed');

  payout.status = 'processing';
  await payout.save();

  try {
    const result = await createRazorpayxPayout({
      amount: payout.netAmount,
      currency: payout.currency,
      referenceId: String(payout._id),
      holderName: account.holderName,
      // Decrypted here and nowhere else: it goes straight into the request body and is
      // never logged, never returned to a client, and never stored in plaintext.
      accountNumber: decryptString(account.accountNumberEncrypted),
      ifsc: account.ifsc,
    });
    payout.razorpayxPayoutId = result.payoutId;
    payout.razorpayxFundAccountId = result.fundAccountId;
    // RazorpayX settles asynchronously; the webhook or an operator confirms the rest.
    payout.status = result.settled ? 'paid' : 'processing';
    if (result.settled) payout.settledAt = new Date();
    await payout.save();
    if (result.settled) await markCommissionsPaid(payout);
  } catch (err) {
    payout.status = 'failed';
    payout.failureReason = err instanceof Error ? err.message : 'transfer failed';
    await payout.save();
    await releaseClaim(payout._id);
    logger.error({ payout: String(payout._id), err }, 'referral payout transfer failed');
    throw err;
  }

  return payout;
}

/** Record a transfer an operator made outside RazorpayX (UPI, NEFT, anything). */
export async function settlePayoutManually(
  payout: PayoutDoc,
  reference: string,
): Promise<PayoutDoc> {
  payout.status = 'paid';
  payout.manualReference = reference;
  payout.settledAt = new Date();
  await payout.save();
  await markCommissionsPaid(payout);
  logger.info({ payout: String(payout._id), reference }, 'referral payout settled manually');
  return payout;
}

export async function failPayout(payout: PayoutDoc, reason: string): Promise<PayoutDoc> {
  payout.status = 'failed';
  payout.failureReason = reason;
  await payout.save();
  await releaseClaim(payout._id);
  logger.info({ payout: String(payout._id), reason }, 'referral payout failed - earnings released');
  return payout;
}

async function markCommissionsPaid(payout: PayoutDoc): Promise<void> {
  await ReferralCommissionModel.updateMany(
    { payoutId: payout._id, status: 'claimed' },
    { $set: { status: 'paid' } },
  );
  await PayoutAccountModel.updateOne(
    { organizationId: payout.organizationId, confirmedAt: null },
    { $set: { confirmedAt: new Date() } },
  );
}
