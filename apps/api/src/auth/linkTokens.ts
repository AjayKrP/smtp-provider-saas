import { createHash, randomBytes } from 'node:crypto';
import { AuthTokenModel, type AuthTokenPurpose } from '@smtp-saas/shared';
import type { Types } from 'mongoose';

export const LINK_TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  verify_email: 24 * 60 * 60_000,
  reset_password: 60 * 60_000,
};

/** Minimum gap between two emails of the same kind to one user. */
export const RESEND_COOLDOWN_MS = 60_000;

export const hashLinkToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Issue a fresh single-use token; returns the raw value to put in the emailed link. */
export async function issueLinkToken(
  userId: Types.ObjectId | string,
  purpose: AuthTokenPurpose,
  now = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await AuthTokenModel.create({
    userId,
    purpose,
    tokenHash: hashLinkToken(token),
    expiresAt: new Date(now.getTime() + LINK_TOKEN_TTL_MS[purpose]),
  });
  return token;
}

/** True if a token of this kind was issued to the user within the resend cooldown. */
export async function issuedRecently(
  userId: Types.ObjectId | string,
  purpose: AuthTokenPurpose,
  now = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - RESEND_COOLDOWN_MS);
  return !!(await AuthTokenModel.exists({ userId, purpose, createdAt: { $gt: since } }));
}

/**
 * Atomically redeem a token: it must match the purpose, be unused and unexpired.
 * Returns the user id, or null for any invalid, expired or already-used token. Other
 * outstanding tokens of the same kind for that user are revoked.
 */
export async function consumeLinkToken(
  token: string,
  purpose: AuthTokenPurpose,
  now = new Date(),
): Promise<Types.ObjectId | null> {
  const redeemed = await AuthTokenModel.findOneAndUpdate(
    { tokenHash: hashLinkToken(token), purpose, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true },
  ).lean();
  if (!redeemed) return null;
  await AuthTokenModel.updateMany(
    { userId: redeemed.userId, purpose, usedAt: null },
    { $set: { usedAt: now } },
  );
  return redeemed.userId;
}
