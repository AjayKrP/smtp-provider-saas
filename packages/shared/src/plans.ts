/**
 * Canonical plan catalog: limits live here, prices live in Razorpay.
 *
 * The API upserts these into the `plans` collection on startup (and `npm run seed`
 * does the same on demand), then reads each paid plan's price — amount and currency —
 * from its Razorpay Item. Change a price on the Item in Razorpay, not here. A payment
 * buys one month of the plan.
 */
export interface PlanDefinition {
  key: string;
  name: string;
  monthlyEmailQuota: number;
  maxDomains: number;
  maxCredentials: number;
  maxMessageSizeBytes: number;
  maxRecipientsPerMessage: number;
  paid: boolean;
  /** Razorpay Item holding a paid plan's price. Unset → the plan cannot be bought yet. */
  razorpayItemId?: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    paid: false,
    monthlyEmailQuota: 500,
    maxDomains: 1,
    maxCredentials: 1,
    maxMessageSizeBytes: 10 * 1024 * 1024,
    maxRecipientsPerMessage: 20,
  },
  {
    key: 'starter',
    name: 'Starter',
    paid: true,
    monthlyEmailQuota: 50_000,
    maxDomains: 3,
    maxCredentials: 5,
    maxMessageSizeBytes: 15 * 1024 * 1024,
    maxRecipientsPerMessage: 50,
  },
  {
    key: 'growth',
    name: 'Growth',
    paid: true,
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
