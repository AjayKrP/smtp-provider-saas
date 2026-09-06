import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { logger } from '@smtp-saas/shared';
import { env } from './env.js';
import { errorHandler } from './http/errors.js';
import { authRouter } from './auth/routes.js';
import { plansRouter } from './plans/routes.js';
import { billingRouter } from './billing/routes.js';
import { stripeWebhookRouter } from './billing/webhook.js';
import { domainsRouter } from './domains/routes.js';
import { credentialsRouter } from './credentials/routes.js';
import { messagesRouter } from './messages/routes.js';
import { usageRouter } from './usage/routes.js';

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: env.DASHBOARD_URL, credentials: true }));

  // Stripe webhook needs the raw body — mount before express.json().
  app.use('/webhooks/stripe', stripeWebhookRouter);

  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 50, standardHeaders: true });
  app.use('/auth', authLimiter, authRouter);
  app.use('/plans', plansRouter);
  app.use('/billing', billingRouter);
  app.use('/domains', domainsRouter);
  app.use('/smtp-credentials', credentialsRouter);
  app.use('/messages', messagesRouter);
  app.use('/usage', usageRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });
  app.use(errorHandler);

  return app;
}
