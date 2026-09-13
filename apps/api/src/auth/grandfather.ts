import { UserModel, logger } from '@smtp-saas/shared';

/**
 * Accounts created before email verification existed have no `emailVerifiedAt` field
 * at all (new accounts store null), so mark them verified rather than lock them out.
 * Idempotent; runs on every API start.
 */
export async function grandfatherVerifiedEmails(): Promise<void> {
  const { modifiedCount } = await UserModel.updateMany({ emailVerifiedAt: { $exists: false } }, [
    { $set: { emailVerifiedAt: { $ifNull: ['$createdAt', '$$NOW'] } } },
  ]);
  if (modifiedCount) logger.info({ modifiedCount }, 'marked pre-verification accounts as verified');
}
