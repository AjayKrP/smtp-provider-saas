/**
 * Canonical plan catalog. `npm run seed` upserts these into the `plans` collection
 * and (when Stripe keys are configured) ensures a matching Stripe Product + Price,
 * writing the price id back to `stripePriceId`.
 */
export interface PlanDefinition {
  key: string;
  name: string;
  priceUsd: number;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxCredentials: number;
  maxMessageSizeBytes: number;
  maxRecipientsPerMessage: number;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    priceUsd: 0,
    monthlyEmailQuota: 500,
    maxDomains: 1,
    maxCredentials: 1,
    maxMessageSizeBytes: 10 * 1024 * 1024,
    maxRecipientsPerMessage: 20,
  },
  {
    key: 'starter',
    name: 'Starter',
    priceUsd: 15,
    monthlyEmailQuota: 50_000,
    maxDomains: 3,
    maxCredentials: 5,
    maxMessageSizeBytes: 15 * 1024 * 1024,
    maxRecipientsPerMessage: 50,
  },
  {
    key: 'growth',
    name: 'Growth',
    priceUsd: 75,
    monthlyEmailQuota: 500_000,
    maxDomains: 10,
    maxCredentials: 25,
    maxMessageSizeBytes: 25 * 1024 * 1024,
    maxRecipientsPerMessage: 100,
  },
];

export const PLAN_KEYS = PLAN_DEFINITIONS.map((p) => p.key);

export function planByKey(key: string): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.key === key);
}
