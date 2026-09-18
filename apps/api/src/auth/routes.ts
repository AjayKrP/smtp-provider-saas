import { Router, type Response } from 'express';
import { z } from 'zod';
import {
  OrganizationModel,
  PlanModel,
  UserModel,
  logger,
  mongoose,
  planByKey,
  type UserDoc,
} from '@smtp-saas/shared';
import { env, isProd } from '../env.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { formatMoney } from '../mail/format.js';
import { sendInBackground, sendTemplate } from '../mail/send.js';
import { hashPassword, verifyPassword } from './password.js';
import { consumeLinkToken, issueLinkToken, issuedRecently } from './linkTokens.js';
import { REFRESH_COOKIE, signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js';
import { auth, requireAuth } from './middleware.js';
import { isAdminEmail, notifyAdminsOfSignup } from '../admin/notify.js';

export const authRouter: Router = Router();

const email = z.string().trim().toLowerCase().email();
const password = z.string().min(10).max(200);

const registerSchema = z.object({
  email,
  password,
  name: z.string().min(1).max(120),
  organizationName: z.string().min(1).max(120).optional(),
});
const loginSchema = z.object({ email, password: z.string().min(1) });
const emailOnlySchema = z.object({ email });
const tokenSchema = z.object({ token: z.string().min(1).max(200) });
const resetSchema = z.object({ token: z.string().min(1).max(200), password });

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: env.JWT_REFRESH_TTL * 1000,
  });
}

function issueSession(
  res: Response,
  user: Pick<UserDoc, '_id' | 'organizationId' | 'sessionVersion'>,
): { accessToken: string; expiresIn: number } {
  const userId = user._id.toString();
  setRefreshCookie(res, signRefreshToken(userId, user.sessionVersion ?? 0));
  return {
    accessToken: signAccessToken({ sub: userId, org: user.organizationId.toString() }),
    expiresIn: env.JWT_ACCESS_TTL,
  };
}

/**
 * Email a fresh verification or reset link. Failures are logged, not thrown: the
 * caller's response must not depend on (or reveal) mail delivery, and the user can
 * ask for another link.
 */
async function sendLink(
  user: UserDoc,
  kind: 'verify_email' | 'reset_password' | 'account_exists',
): Promise<void> {
  try {
    const purpose = kind === 'verify_email' ? 'verify_email' : 'reset_password';
    const token = await issueLinkToken(user._id, purpose);
    const path = purpose === 'verify_email' ? 'verify-email' : 'reset-password';
    const link = `${env.DASHBOARD_URL}/${path}?token=${encodeURIComponent(token)}`;
    if (kind === 'verify_email') {
      await sendTemplate(user.email, 'verify-email', { name: user.name, verifyUrl: link });
    } else if (kind === 'reset_password') {
      await sendTemplate(user.email, 'password-reset', { name: user.name, resetUrl: link });
    } else {
      await sendTemplate(user.email, 'account-exists', {
        name: user.name,
        signInUrl: `${env.DASHBOARD_URL}/login`,
        resetUrl: link,
      });
    }
  } catch (err) {
    logger.error({ err, userId: user._id.toString(), kind }, 'failed to send auth email');
  }
}

/** Sent once, when an address is first confirmed. Failures are logged, never thrown. */
async function sendWelcome(user: UserDoc): Promise<void> {
  try {
    const plans = await PlanModel.find({}).lean();
    const free = plans.find((p) => p.key === 'free') ?? planByKey('free');
    const cheapestPaid = plans
      .filter((p) => p.paid && typeof p.unitAmount === 'number' && p.currency)
      .sort((a, b) => a.unitAmount! - b.unitAmount!)[0];
    const app = env.DASHBOARD_URL;
    await sendTemplate(user.email, 'welcome', {
      name: user.name,
      dashboardUrl: app,
      domainsUrl: `${app}/domains`,
      credentialsUrl: `${app}/credentials`,
      freePlanName: free?.name ?? 'Free',
      freeQuota: (free?.monthlyEmailQuota ?? 0).toLocaleString('en-IN'),
      paidFrom: cheapestPaid
        ? formatMoney(cheapestPaid.unitAmount!, cheapestPaid.currency!, { whole: true })
        : null,
      pricingUrl: `${app}/pricing`,
    });
  } catch (err) {
    logger.error({ err, userId: user._id.toString() }, 'failed to send welcome email');
  }
}

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const body = req.body as z.infer<typeof registerSchema>;

  // Hash first so new and already-registered emails take about the same time.
  const passwordHash = await hashPassword(body.password);
  const pending = { verificationRequired: true, email: body.email };

  // Never reveal that an email is registered: answer exactly as for a new account and
  // tell the real owner by email instead (at most once per cooldown).
  const existing = await UserModel.findOne({ email: body.email });
  if (existing) {
    if (!existing.emailVerifiedAt) {
      if (!(await issuedRecently(existing._id, 'verify_email'))) {
        sendInBackground(sendLink(existing, 'verify_email'));
      }
    } else if (!(await issuedRecently(existing._id, 'reset_password'))) {
      sendInBackground(sendLink(existing, 'account_exists'));
    }
    res.status(201).json(pending);
    return;
  }

  const orgId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await OrganizationModel.create(
        [
          {
            _id: orgId,
            name: body.organizationName ?? `${body.name}'s workspace`,
            ownerUserId: userId,
            planKey: 'free',
          },
        ],
        { session },
      );
      await UserModel.create(
        [{ _id: userId, email: body.email, passwordHash, name: body.name, organizationId: orgId }],
        { session },
      );
    });
  } catch (err) {
    // Lost a race with a concurrent signup for the same email: same answer as above.
    if ((err as { code?: number }).code === 11000) {
      res.status(201).json(pending);
      return;
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const user = await UserModel.findById(userId);
  if (user) {
    sendInBackground(sendLink(user, 'verify_email'));
    sendInBackground(notifyAdminsOfSignup(user));
  }
  // No session until the address is confirmed.
  res.status(201).json(pending);
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const body = req.body as z.infer<typeof loginSchema>;
  const user = await UserModel.findOne({ email: body.email });
  if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  // Checked only after the password, so this never reveals which emails are registered.
  if (!user.emailVerifiedAt) {
    throw new ApiError(
      403,
      'Please confirm your email address first — check your inbox for the verification link.',
      'email_not_verified',
    );
  }
  res.json(issueSession(res, user));
});

authRouter.post('/verify-email', validateBody(tokenSchema), async (req, res) => {
  const { token } = req.body as z.infer<typeof tokenSchema>;
  const userId = await consumeLinkToken(token, 'verify_email');
  if (!userId) {
    throw ApiError.badRequest('This verification link is invalid or has expired.');
  }
  const before = await UserModel.findById(userId).lean();
  const user = await UserModel.findOneAndUpdate(
    { _id: userId },
    [{ $set: { emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] } } }],
    { new: true },
  );
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired.');
  if (before && !before.emailVerifiedAt) sendInBackground(sendWelcome(user));
  // The link proves control of the inbox, so sign the user straight in.
  res.json(issueSession(res, user));
});

// The next two always answer the same way, so they cannot be used to probe which
// emails have accounts. Repeat requests within the cooldown send nothing.
const GENERIC_OK = { ok: true };

authRouter.post('/resend-verification', validateBody(emailOnlySchema), async (req, res) => {
  const user = await UserModel.findOne({ email: (req.body as { email: string }).email });
  if (user && !user.emailVerifiedAt && !(await issuedRecently(user._id, 'verify_email'))) {
    sendInBackground(sendLink(user, 'verify_email'));
  }
  res.json(GENERIC_OK);
});

authRouter.post('/forgot-password', validateBody(emailOnlySchema), async (req, res) => {
  const user = await UserModel.findOne({ email: (req.body as { email: string }).email });
  if (user && !(await issuedRecently(user._id, 'reset_password'))) {
    sendInBackground(sendLink(user, 'reset_password'));
  }
  res.json(GENERIC_OK);
});

authRouter.post('/reset-password', validateBody(resetSchema), async (req, res) => {
  const body = req.body as z.infer<typeof resetSchema>;
  const userId = await consumeLinkToken(body.token, 'reset_password');
  if (!userId) throw ApiError.badRequest('This reset link is invalid or has expired.');

  const passwordHash = await hashPassword(body.password);
  await UserModel.updateOne({ _id: userId }, [
    {
      $set: {
        // $literal: an argon2 hash starts with "$", which a pipeline would read as a field path.
        passwordHash: { $literal: passwordHash },
        // Receiving the reset email proves the address, too.
        emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] },
        // Sign out every existing session.
        sessionVersion: { $add: [{ $ifNull: ['$sessionVersion', 0] }, 1] },
      },
    },
  ]);
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  res.json({ ok: true });
});

authRouter.post('/refresh', async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('Missing refresh token');
  let claims: { sub: string; ver: number };
  try {
    claims = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await UserModel.findById(claims.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if ((user.sessionVersion ?? 0) !== claims.ver) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }
  res.json(issueSession(res, user));
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { userId } = auth(req);
  const user = await UserModel.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found');
  const org = await OrganizationModel.findById(user.organizationId).lean();
  res.json({
    id: user._id,
    email: user.email,
    name: user.name,
    isAdmin: !!user.emailVerifiedAt && isAdminEmail(user.email),
    organization: org && {
      id: org._id,
      name: org.name,
      planKey: org.planKey,
    },
  });
});
