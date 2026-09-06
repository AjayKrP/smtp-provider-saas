import Stripe from 'stripe';
import {
  OrganizationModel,
  PlanModel,
  SubscriptionModel,
  logger,
  type SubscriptionStatus,
} from '@smtp-saas/shared';
import { env } from '../env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'canceled',
  paused: 'past_due',
};

/** Ensure the organization has a Stripe customer; returns the customer id. */
export async function ensureStripeCustomer(organizationId: string): Promise<string> {
  const org = await OrganizationModel.findById(organizationId);
  if (!org) throw new Error(`organization ${organizationId} not found`);
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: { organizationId },
  });
  org.stripeCustomerId = customer.id;
  await org.save();
  return customer.id;
}

/** Reconcile our Subscription + Organization.planKey from a Stripe subscription object. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const plan = priceId ? await PlanModel.findOne({ stripePriceId: priceId }).lean() : null;
  const status = STATUS_MAP[sub.status] ?? 'past_due';

  const org = await OrganizationModel.findOne({ stripeCustomerId: sub.customer as string });
  if (!org) {
    logger.warn({ customer: sub.customer }, 'stripe subscription for unknown customer');
    return;
  }

  const activePlanKey = ['trialing', 'active'].includes(status) && plan ? plan.key : 'free';
  const { start, end } = periodBounds(sub);

  await SubscriptionModel.updateOne(
    { organizationId: org._id },
    {
      $set: {
        planKey: plan?.key ?? 'free',
        status,
        stripeCustomerId: sub.customer as string,
        stripeSubscriptionId: sub.id,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    },
    { upsert: true },
  );

  org.planKey = activePlanKey;
  await org.save();
  logger.info({ org: org.id, planKey: activePlanKey, status }, 'subscription synced');
}

/**
 * Read the current billing period. Stripe moved these fields onto subscription items
 * in recent API versions, so fall back to the item if the top-level fields are absent.
 */
function periodBounds(sub: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const s = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const item = sub.items.data[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const startTs = s.current_period_start ?? item?.current_period_start;
  const endTs = s.current_period_end ?? item?.current_period_end;
  return {
    start: startTs ? new Date(startTs * 1000) : null,
    end: endTs ? new Date(endTs * 1000) : null,
  };
}

export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  const sub = await SubscriptionModel.findOne({ stripeSubscriptionId });
  if (!sub) return;
  sub.status = 'canceled';
  await sub.save();
  await OrganizationModel.updateOne({ _id: sub.organizationId }, { $set: { planKey: 'free' } });
}
