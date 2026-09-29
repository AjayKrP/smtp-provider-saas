import {
  OrganizationModel,
  PaymentModel,
  ReferralCommissionModel,
  availableAt,
  commissionFor,
  generateReferralCode,
  logger,
  normalizeReferralCode,
  type PaymentDoc,
} from '@smtp-saas/shared';
import { env } from '../env.js';

const DUPLICATE_KEY = 11000;

/**
 * Mint this organization's referral code, or return the one it already has.
 *
 * Codes are created on first use rather than at signup, so accounts that predate the
 * program get one the moment they open the referrals page. The retry loop exists because
 * uniqueness is enforced by the index, not by checking first — checking first is a race.
 */
export async function ensureReferralCode(organizationId: string): Promise<string> {
  const existing = await OrganizationModel.findById(organizationId, { referralCode: 1 }).lean();
  if (!existing) throw new Error(`unknown organization ${organizationId}`);
  if (existing.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    try {
      const updated = await OrganizationModel.findOneAndUpdate(
        { _id: organizationId, referralCode: null },
        { $set: { referralCode: code } },
        { new: true, projection: { referralCode: 1 } },
      );
      // Null means another request minted one first; read it back rather than overwrite.
      if (!updated) break;
      return updated.referralCode ?? code;
    } catch (err) {
      if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    }
  }

  const settled = await OrganizationModel.findById(organizationId, { referralCode: 1 }).lean();
  if (settled?.referralCode) return settled.referralCode;
  throw new Error('could not allocate a referral code');
}

/**
 * Resolve a referral code to the organization that owns it.
 *
 * Returns null for anything unrecognised rather than failing: a mistyped or expired code
 * must never block a signup, because the person signing up did not choose it and cannot
 * fix it.
 */
export async function referrerForCode(code: string): Promise<string | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const org = await OrganizationModel.findOne({ referralCode: normalized }, { _id: 1 }).lean();
  return org ? String(org._id) : null;
}

/**
 * Record the attribution on a newly created organization.
 *
 * Self-referral is impossible by construction here (the referred organization is seconds
 * old and the code belongs to an older one), but it is still checked, because the cheapest
 * fraud in any referral program is signing up through your own link.
 */
export async function attributeSignup(
  refereeOrganizationId: string,
  referrerOrganizationId: string,
): Promise<void> {
  if (refereeOrganizationId === referrerOrganizationId) return;
  await OrganizationModel.updateOne(
    { _id: refereeOrganizationId, referredByOrganizationId: null },
    {
      $set: {
        referredByOrganizationId: referrerOrganizationId,
        referredAt: new Date(),
      },
    },
  );
}

/**
 * Award the referrer their cut of a payment that has just been credited.
 *
 * Called from fulfillOrder's onPaid hook, which already runs at most once per payment —
 * but the unique index on `paymentId` is the real guarantee, because a webhook replay
 * weeks later would otherwise pay a second time.
 *
 * Every purchase earns a commission, not just the first: the referrer keeps earning for
 * as long as the organization they brought keeps paying.
 */
export async function awardReferralCommission(payment: PaymentDoc): Promise<void> {
  if (env.REFERRAL_COMMISSION_PERCENT <= 0) return;

  const referee = await OrganizationModel.findById(payment.organizationId, {
    referredByOrganizationId: 1,
  }).lean();
  const referrerId = referee?.referredByOrganizationId;
  if (!referrerId) return;
  if (String(referrerId) === String(payment.organizationId)) {
    logger.warn(
      { org: String(payment.organizationId) },
      'organization is marked as referred by itself - no commission awarded',
    );
    return;
  }

  const amount = commissionFor(payment.amount, env.REFERRAL_COMMISSION_PERCENT);
  if (amount <= 0) return;

  const paidAt = payment.paidAt ?? new Date();
  try {
    await ReferralCommissionModel.create({
      referrerOrganizationId: referrerId,
      refereeOrganizationId: payment.organizationId,
      paymentId: payment._id,
      grossAmount: payment.amount,
      percent: env.REFERRAL_COMMISSION_PERCENT,
      amount,
      currency: payment.currency.toUpperCase(),
      status: 'pending',
      availableAt: availableAt(paidAt, env.REFERRAL_HOLD_DAYS),
    });
  } catch (err) {
    // Already awarded for this payment: the replay is the expected cause, not an error.
    if ((err as { code?: number }).code === DUPLICATE_KEY) return;
    throw err;
  }

  logger.info(
    {
      referrer: String(referrerId),
      referee: String(payment.organizationId),
      amount,
      percent: env.REFERRAL_COMMISSION_PERCENT,
    },
    'referral commission awarded',
  );
}

/**
 * Undo commissions for a refunded or charged-back payment.
 *
 * Only earnings that have not left yet can be taken back. Once a payout has claimed them
 * the money is committed, so this logs loudly for an operator instead of quietly creating
 * a negative balance — the hold window exists to make that case rare.
 */
export async function reverseCommissionsForPayment(
  razorpayPaymentId: string,
  reason: string,
): Promise<void> {
  const payment = await PaymentModel.findOne({ razorpayPaymentId }, { _id: 1 }).lean();
  if (!payment) return;

  const commissions = await ReferralCommissionModel.find({ paymentId: payment._id });
  for (const commission of commissions) {
    if (commission.status === 'pending' || commission.status === 'available') {
      commission.status = 'reversed';
      commission.reversedAt = new Date();
      commission.reversalReason = reason;
      await commission.save();
      logger.info(
        { commission: String(commission._id), amount: commission.amount, reason },
        'referral commission reversed',
      );
    } else if (commission.status === 'claimed' || commission.status === 'paid') {
      logger.error(
        {
          commission: String(commission._id),
          referrer: String(commission.referrerOrganizationId),
          amount: commission.amount,
          status: commission.status,
          reason,
        },
        'refunded payment had an already-committed referral commission - recover it by hand',
      );
    }
  }
}
