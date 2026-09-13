/**
 * Idempotent seed: upserts the plan catalog limits and pulls each paid plan's price
 * from its Stripe product. The API does the same on every startup, so this is only
 * needed to refresh the database without restarting it.
 *
 *   npm run seed          (from repo root)
 */
import { connectMongo, disconnectMongo, logger } from '@smtp-saas/shared';
import { syncPlanCatalog } from '../plans/catalog.js';

async function main(): Promise<void> {
  await connectMongo();
  await syncPlanCatalog();
  await disconnectMongo();
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
