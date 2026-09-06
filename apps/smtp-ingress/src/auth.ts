import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { SmtpCredentialModel } from '@smtp-saas/shared';

export interface AuthedCredential {
  credentialId: string;
  organizationId: string;
  username: string;
}

/**
 * Verify SMTP AUTH credentials. Always runs an argon2 verification (against a dummy
 * hash when the user is unknown) to avoid leaking valid usernames via timing.
 */
const DUMMY_HASH_PROMISE = argon2.hash(randomBytes(16).toString('hex'));

export async function authenticateCredential(
  username: string,
  password: string,
): Promise<AuthedCredential | null> {
  const cred = await SmtpCredentialModel.findOne({ username, active: true });
  const hash = cred?.passwordHash ?? (await DUMMY_HASH_PROMISE);
  const ok = await argon2.verify(hash, password).catch(() => false);
  if (!ok || !cred) return null;

  // Best-effort last-used timestamp; don't block auth on it.
  void SmtpCredentialModel.updateOne({ _id: cred._id }, { $set: { lastUsedAt: new Date() } }).catch(
    () => undefined,
  );

  return {
    credentialId: cred._id.toString(),
    organizationId: cred.organizationId.toString(),
    username,
  };
}
