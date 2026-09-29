/**
 * Referral code capture.
 *
 * Someone arrives on /r/<code>, reads the site, and registers minutes later on a different
 * page — so the code has to outlive that navigation. It is kept in localStorage rather
 * than a cookie because it is not a credential and nothing on the server reads it until
 * the registration request carries it explicitly.
 *
 * Attribution is decided server-side at signup, so a code that is stale, mistyped or
 * someone's own simply earns nothing.
 */
const KEY = 'e4vc_referral_code';

export function rememberReferralCode(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim().toUpperCase().slice(0, 32));
  } catch {
    // Private mode: the code is lost, which costs a referral and nothing else.
  }
}

export function readReferralCode(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Called after a successful signup: the code has done its job and should not linger. */
export function clearReferralCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; a stale code only ever affects this browser's next signup.
  }
}
