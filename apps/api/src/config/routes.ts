import { Router } from 'express';
import { env } from '../env.js';
import { mailSender } from '../mail/sender.js';

/**
 * Public, unauthenticated settings the marketing site and dashboard need to show
 * accurate instructions. The SMTP host is deliberately not derived from the browser's
 * own hostname: the website and the mail server live on different names.
 */
export const configRouter: Router = Router();

const smtpHost = env.SMTP_PUBLIC_HOST ?? new URL(env.API_PUBLIC_URL).hostname;

configRouter.get('/', (_req, res) => {
  res.json({
    smtpHost,
    smtpPorts: { starttls: 587, tls: 465 },
    supportEmail: mailSender().supportEmail,
  });
});
