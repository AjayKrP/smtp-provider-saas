/**
 * Idempotent seed: upserts the plan catalog and, when a real Stripe key is present,
 * ensures a matching Stripe Product + recurring Price and records the ids.
 *
 *   npm run seed          (from repo root)
 */
import { PLAN_DEFINITIONS, PlanModel, connectMongo, disconnectMongo, logger } from '@smtp-saas/shared';
import { env } from '../env.js';
import { stripe } from '../billing/stripe.js';

// A real key is sk_(test|live)_ followed by a long random string; anything shorter
// (sk_test_xxx, sk_test_placeholder, …) is treated as "billing not configured yet".
const stripeEnabled = /^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(env.STRIPE_SECRET_KEY);

async function findOrCreateProduct(planKey: string, name: string, productId?: string) {
  if (productId) return stripe.products.retrieve(productId);
  const found = await stripe.products.search({ query: `metadata['planKey']:'${planKey}'`, limit: 1 });
  return (
    found.data[0] ??
    (await stripe.products.create({ name: `SMTP SaaS — ${name}`, metadata: { planKey } }))
  );
}

async function ensureStripePrice(
  planKey: string,
  name: string,
  priceUsd: number,
  productId?: string,
) {
  const product = await findOrCreateProduct(planKey, name, productId);

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const wantAmount = Math.round(priceUsd * 100);
  const existing = prices.data.find(
    (p) => p.unit_amount === wantAmount && p.recurring?.interval === 'month' && p.currency === 'usd',
  );
  const price =
    existing ??
    (await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: wantAmount,
      recurring: { interval: 'month' },
      metadata: { planKey },
    }));

  return { productId: product.id, priceId: price.id };
}

async function main(): Promise<void> {
  await connectMongo();

  for (const def of PLAN_DEFINITIONS) {
    let stripeProductId: string | null = null;
    let stripePriceId: string | null = null;

    if (stripeEnabled && def.priceUsd > 0) {
      try {
        const ids = await ensureStripePrice(def.key, def.name, def.priceUsd, def.stripeProductId);
        stripeProductId = ids.productId;
        stripePriceId = ids.priceId;
      } catch (err) {
        logger.error({ err, plan: def.key }, 'Stripe product/price setup failed — check STRIPE_SECRET_KEY');
      }
    }

    await PlanModel.updateOne(
      { key: def.key },
      {
        $set: {
          name: def.name,
          priceUsd: def.priceUsd,
          monthlyEmailQuota: def.monthlyEmailQuota,
          maxDomains: def.maxDomains,
          maxCredentials: def.maxCredentials,
          maxMessageSizeBytes: def.maxMessageSizeBytes,
          maxRecipientsPerMessage: def.maxRecipientsPerMessage,
          ...(stripeProductId ? { stripeProductId } : {}),
          ...(stripePriceId ? { stripePriceId } : {}),
        },
      },
      { upsert: true },
    );
    logger.info({ plan: def.key, stripePriceId }, 'plan seeded');
  }

  if (!stripeEnabled) {
    logger.warn('STRIPE_SECRET_KEY not set to a real key — skipped Stripe product/price creation');
  }

  await disconnectMongo();
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
