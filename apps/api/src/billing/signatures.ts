import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time check that `signature` is the hex HMAC-SHA256 of `payload` under
 * `secret`. An unset secret never matches, so a missing config fails closed.
 */
export function hmacSha256Matches(
  payload: string | Buffer,
  secret: string | undefined,
  signature: string,
): boolean {
  if (!secret) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
