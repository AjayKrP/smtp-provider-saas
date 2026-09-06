import { Router } from 'express';
import { z } from 'zod';
import {
  UserModel,
  OrganizationModel,
  mongoose,
} from '@smtp-saas/shared';
import { env, isProd } from '../env.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  REFRESH_COOKIE,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.js';
import { auth, requireAuth } from './middleware.js';

export const authRouter: Router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  name: z.string().min(1).max(120),
  organizationName: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: env.JWT_REFRESH_TTL * 1000,
  });
}

function issueSession(
  res: import('express').Response,
  userId: string,
  organizationId: string,
): { accessToken: string; expiresIn: number } {
  setRefreshCookie(res, signRefreshToken(userId));
  return { accessToken: signAccessToken({ sub: userId, org: organizationId }), expiresIn: env.JWT_ACCESS_TTL };
}

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const { email, password, name, organizationName } = req.body as z.infer<typeof registerSchema>;

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const passwordHash = await hashPassword(password);
  const orgId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await OrganizationModel.create(
        [
          {
            _id: orgId,
            name: organizationName ?? `${name}'s workspace`,
            ownerUserId: userId,
            planKey: 'free',
          },
        ],
        { session },
      );
      await UserModel.create(
        [{ _id: userId, email, passwordHash, name, organizationId: orgId }],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json(issueSession(res, userId.toString(), orgId.toString()));
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await UserModel.findOne({ email });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  res.json(issueSession(res, user._id.toString(), user.organizationId.toString()));
});

authRouter.post('/refresh', async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('Missing refresh token');
  let userId: string;
  try {
    userId = verifyRefreshToken(token).sub;
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await UserModel.findById(userId).lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  res.json(issueSession(res, userId, user.organizationId.toString()));
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
    organization: org && {
      id: org._id,
      name: org.name,
      planKey: org.planKey,
      stripeCustomerId: org.stripeCustomerId,
    },
  });
});
