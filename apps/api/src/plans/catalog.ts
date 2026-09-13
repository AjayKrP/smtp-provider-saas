import { PLAN_DEFINITIONS, PlanModel, logger, type PlanDefinition } from '@smtp-saas/shared';
import { fetchItem, razorpayConfigured } from '../billing/razorpay.js';

const NO_PRICE = { unitAmount: null, currency: null };

async function syncPlan(def: PlanDefinition): Promise<void> {
  const { razorpayItemId, ...limits } = def;
  // Fields left behind by the Stripe integration.
  const unset = { stripeProductId: 1, stripePriceId: 1, interval: 1, priceUsd: 1 };

  // Limits always come from code, even if Razorpay is unreachable right now.
  await PlanModel.updateOne(
    { key: def.key },
    {
      $set: { ...limits, razorpayItemId: razorpayItemId ?? null, ...(def.paid ? {} : NO_PRICE) },
      $unset: unset,
    },
    { upsert: true, strict: false },
  );
  if (!def.paid) return;

  if (!razorpayItemId) {
    await PlanModel.updateOne({ key: def.key }, { $set: NO_PRICE });
    logger.warn({ plan: def.key }, 'paid plan has no razorpayItemId - it cannot be purchased');
    return;
  }
  if (!razorpayConfigured) return;

  try {
    const item = await fetchItem(razorpayItemId);
    const price = item.active
      ? { unitAmount: item.amount, currency: item.currency.toLowerCase() }
      : NO_PRICE;
    await PlanModel.updateOne({ key: def.key }, { $set: { ...price, priceSyncedAt: new Date() } });
    if (item.active) {
      logger.info({ plan: def.key, razorpayItemId, ...price }, 'plan price synced from razorpay');
    } else {
      logger.warn(
        { plan: def.key, razorpayItemId },
        'razorpay item is inactive - plan cannot be purchased',
      );
    }
  } catch (err) {
    // Keep the last synced price rather than wiping it on a transient Razorpay error.
    logger.error({ err, plan: def.key, razorpayItemId }, 'plan price sync from razorpay failed');
  }
}

/**
 * Bring the `plans` collection in line with the code catalog (limits) and Razorpay
 * Items (prices). Idempotent and never throws, so it is safe to call from startup, a
 * timer and the seed script alike.
 */
export async function syncPlanCatalog(): Promise<void> {
  if (!razorpayConfigured) {
    logger.warn('RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set - plan prices were not synced');
  }
  for (const def of PLAN_DEFINITIONS) {
    await syncPlan(def).catch((err: unknown) => {
      logger.error({ err, plan: def.key }, 'plan catalog sync failed');
    });
  }
}
