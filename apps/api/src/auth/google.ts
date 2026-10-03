import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';
import { ApiError } from '../http/errors.js';

/**
 * Verification of the ID token Google Identity Services hands the browser.
 *
 * This is sign-in only, so there is no authorization-code exchange, no client secret and
 * no callback route: the browser gets a signed ID token, we check the signature against
 * Google's rotating keys and read the claims. google-auth-library handles fetching and
 * caching those keys, which is the part worth not hand-rolling in an auth path.
 */
export const googleSignInConfigured = !!env.GOOGLE_CLIENT_ID;

let client: OAuth2Client | undefined;
const oauthClient = (): OAuth2Client => (client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID));

export interface GoogleIdentity {
  /** Google's stable subject id. The join key — an email can change, this cannot. */
  sub: string;
  email: string;
  /** Whether Google asserts this person controls that address. */
  emailVerified: boolean;
  name: string;
}

/**
 * Verify a credential from the browser and return the identity it asserts.
 *
 * `verifyIdToken` checks the signature, the issuer, the expiry and that the audience is
 * our own client id — that last one is what stops a token minted for somebody else's
 * Google app being replayed here.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
  if (!googleSignInConfigured) {
    throw new ApiError(503, 'Google sign-in is not configured', 'not_configured');
  }

  let payload;
  try {
    const ticket = await oauthClient().verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID!,
    });
    payload = ticket.getPayload();
  } catch {
    // Expired, malformed, wrong audience, bad signature — all the same to the caller,
    // and none of them worth describing back to an unauthenticated client.
    throw ApiError.unauthorized('That Google sign-in could not be verified. Please try again.');
  }

  if (!payload?.sub || !payload.email) {
    throw ApiError.unauthorized('Google did not return an email address for that account.');
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase().trim(),
    emailVerified: payload.email_verified === true,
    // Google omits `name` for some accounts; the local part is a better placeholder than
    // an empty string, and the person can change it later.
    name: payload.name?.trim() || payload.email.split('@')[0]!,
  };
}
