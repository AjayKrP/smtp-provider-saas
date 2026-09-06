import { Router } from 'express';
import { z } from 'zod';
import {
  SmtpCredentialModel,
  generateSmtpPassword,
  generateSmtpUsername,
} from '@smtp-saas/shared';
import { env } from '../env.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';
import { orgPlanLimits } from '../plans/limits.js';

export const credentialsRouter: Router = Router();
credentialsRouter.use(requireAuth);

const createSchema = z.object({ label: z.string().trim().min(1).max(80) });

credentialsRouter.get('/', async (req, res) => {
  const { organizationId } = auth(req);
  const creds = await SmtpCredentialModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
  res.json(
    creds.map((c) => ({
      id: c._id,
      username: c.username,
      label: c.label,
      active: c.active,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    })),
  );
});

credentialsRouter.post('/', validateBody(createSchema), async (req, res) => {
  const { organizationId } = auth(req);
  const { label } = req.body as z.infer<typeof createSchema>;

  const [count, limits] = await Promise.all([
    SmtpCredentialModel.countDocuments({ organizationId, active: true }),
    orgPlanLimits(organizationId),
  ]);
  if (count >= limits.maxCredentials) {
    throw ApiError.payment(`Your ${limits.name} plan allows ${limits.maxCredentials} SMTP credential(s)`);
  }

  const username = generateSmtpUsername();
  const password = generateSmtpPassword();
  const created = await SmtpCredentialModel.create({
    organizationId,
    username,
    passwordHash: await hashPassword(password),
    label,
  });

  // The password is returned exactly once here and never stored in plaintext.
  res.status(201).json({
    id: created._id,
    label: created.label,
    smtp: {
      host: env.SMTP_PUBLIC_HOST ?? new URL(env.API_PUBLIC_URL).hostname,
      ports: { starttls: 587, tls: 465 },
      username,
      password,
    },
  });
});

credentialsRouter.delete('/:id', async (req, res) => {
  const { organizationId } = auth(req);
  const doc = await SmtpCredentialModel.findOne({ _id: req.params.id, organizationId });
  if (!doc) throw ApiError.notFound('Credential not found');
  await doc.deleteOne();
  res.status(204).end();
});
