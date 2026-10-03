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
    // The Google client id is public by design — it ships to every browser that renders
    // the sign-in button. Served here rather than baked into the bundle so enabling it
    // is an env change, not a rebuild. Null means the button simply does not render.
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    // The referral terms are advertised on public pages, so they are served from the
    // same config the program enforces. A literal in the marketing copy would be a
    // second source of truth, and the one that goes stale.
    referral: {
      percent: env.REFERRAL_COMMISSION_PERCENT,
      holdDays: env.REFERRAL_HOLD_DAYS,
      minimumPayout: env.REFERRAL_MIN_PAYOUT,
      currency: 'INR',
    },
  });
});
