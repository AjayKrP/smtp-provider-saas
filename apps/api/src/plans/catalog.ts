import { PLAN_DEFINITIONS, PlanModel, logger, type PlanDefinition } from '@smtp-saas/shared';
import { stripe, stripeConfigured } from '../billing/stripe.js';
import { pickPlanPrice, usable, type PlanPrice } from './pickPlanPrice.js';

async function fetchPlanPrice(productId: string): Promise<PlanPrice | null> {
  const product = await stripe.products.retrieve(productId, { expand: ['default_price'] });
  if (!product.active) return null;
  const defaultPrice = typeof product.default_price === 'object' ? product.default_price : null;
  if (usable(defaultPrice)) return pickPlanPrice(defaultPrice, []);
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return pickPlanPrice(null, prices.data);
}

const NO_PRICE = { stripePriceId: null, unitAmount: null, currency: null, interval: null };

async function syncPlan(def: PlanDefinition): Promise<void> {
  const { stripeProductId, ...limits } = def;
  // `priceUsd` is the pre-Stripe-pricing field; drop it from rows written by older seeds.
  const unset = { priceUsd: 1 };

  if (!stripeProductId) {
    await PlanModel.updateOne(
      { key: def.key },
      { $set: { ...limits, stripeProductId: null, ...NO_PRICE, unitAmount: 0 }, $unset: unset },
      { upsert: true, strict: false },
    );
    return;
  }

  // Limits always come from code, even if Stripe is unreachable right now.
  await PlanModel.updateOne(
    { key: def.key },
    { $set: { ...limits, stripeProductId }, $unset: unset },
    { upsert: true, strict: false },
  );
  if (!stripeConfigured) return;

  try {
    const price = await fetchPlanPrice(stripeProductId);
    await PlanModel.updateOne(
      { key: def.key },
      { $set: { ...(price ?? NO_PRICE), priceSyncedAt: new Date() } },
    );
    if (price) {
      logger.info({ plan: def.key, ...price }, 'plan price synced from stripe');
    } else {
      logger.warn(
        { plan: def.key, stripeProductId },
        'stripe product has no active recurring price (or is archived) - plan cannot be purchased',
      );
    }
  } catch (err) {
    // Keep the last synced price rather than wiping it on a transient Stripe error.
    logger.error({ err, plan: def.key, stripeProductId }, 'plan price sync from stripe failed');
  }
}

/**
 * Bring the `plans` collection in line with the code catalog (limits) and Stripe
 * (prices). Idempotent and never throws, so it is safe to call from startup, a
 * timer, webhooks and the seed script alike.
 */
export async function syncPlanCatalog(): Promise<void> {
  if (!stripeConfigured) {
    logger.warn('STRIPE_SECRET_KEY is not a real key - plan prices were not synced from Stripe');
  }
  for (const def of PLAN_DEFINITIONS) {
    await syncPlan(def).catch((err: unknown) => {
      logger.error({ err, plan: def.key }, 'plan catalog sync failed');
    });
  }
}
