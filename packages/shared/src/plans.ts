/**
 * Canonical plan catalog: limits live here, prices live in Stripe.
 *
 * The API upserts these into the `plans` collection on startup (and `npm run seed`
 * does the same on demand), then reads each paid plan's price — amount, currency,
 * interval — from its Stripe product's default price. Change a price in the Stripe
 * dashboard, not here.
 */
export interface PlanDefinition {
  key: string;
  name: string;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxCredentials: number;
  maxMessageSizeBytes: number;
  maxRecipientsPerMessage: number;
  /** Stripe product this plan is billed under. Absent means the plan is free. */
  stripeProductId?: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    monthlyEmailQuota: 500,
    maxDomains: 1,
    maxCredentials: 1,
    maxMessageSizeBytes: 10 * 1024 * 1024,
    maxRecipientsPerMessage: 20,
  },
  {
    key: 'starter',
    name: 'Starter',
    monthlyEmailQuota: 50_000,
    maxDomains: 3,
    maxCredentials: 5,
    maxMessageSizeBytes: 15 * 1024 * 1024,
    maxRecipientsPerMessage: 50,
    stripeProductId: 'prod_VFf4wKVlyg0xcu',
  },
  {
    key: 'growth',
    name: 'Growth',
    monthlyEmailQuota: 500_000,
    maxDomains: 10,
    maxCredentials: 25,
    maxMessageSizeBytes: 25 * 1024 * 1024,
    maxRecipientsPerMessage: 100,
    stripeProductId: 'prod_VFfCN7aOVOa2z4',
  },
];

export const PLAN_KEYS = PLAN_DEFINITIONS.map((p) => p.key);

export function planByKey(key: string): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.key === key);
}
