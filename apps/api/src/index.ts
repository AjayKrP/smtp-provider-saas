import { connectMongo, disconnectMongo, logger } from '@smtp-saas/shared';
import { env } from './env.js';
import { createApp } from './app.js';
import { googleSignInConfigured } from './auth/google.js';
import { syncPlanCatalog } from './plans/catalog.js';
import { grandfatherVerifiedEmails } from './auth/grandfather.js';

// Picks up price changes made on the Razorpay Items (Razorpay sends no item webhooks).
const PLAN_SYNC_INTERVAL_MS = 15 * 60_000;

async function main(): Promise<void> {
  await connectMongo();
  await grandfatherVerifiedEmails();
  // Not awaited: a slow Razorpay must not hold up startup and the deploy health check.
  void syncPlanCatalog();
  const planSync = setInterval(() => void syncPlanCatalog(), PLAN_SYNC_INTERVAL_MS);
  planSync.unref();

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    // Optional integrations are reported at boot so a missing env var shows up in the
    // log rather than as a feature that quietly is not there. An env_file change only
    // reaches the process when the container is recreated, which is exactly the kind of
    // thing this line makes obvious.
    logger.info(
      {
        port: env.API_PORT,
        adminEmails: env.ADMIN_EMAILS.length,
        googleSignIn: googleSignInConfigured,
        razorpay: !!env.RAZORPAY_KEY_ID,
        referralCommissionPercent: env.REFERRAL_COMMISSION_PERCENT,
        referralWithholdingPercent: env.REFERRAL_TDS_PERCENT,
      },
      'api listening',
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down api');
    server.close(() => {
      void disconnectMongo().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'api failed to start');
  process.exit(1);
});
