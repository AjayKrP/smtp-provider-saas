import type Stripe from 'stripe';

export interface PlanPrice {
  stripePriceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
}

export const usable = (
  p: Stripe.Price | null | undefined,
): p is Stripe.Price & { recurring: Stripe.Price.Recurring; unit_amount: number } =>
  !!p && p.active && !!p.recurring && p.unit_amount !== null;

/**
 * The price a plan is sold at: the product's default price when it is an active
 * recurring price, otherwise its newest active recurring price (Stripe lists newest
 * first). Subscription Checkout cannot use one-time prices, so those never qualify.
 */
export function pickPlanPrice(
  defaultPrice: Stripe.Price | null,
  activePrices: Stripe.Price[],
): PlanPrice | null {
  const price = usable(defaultPrice) ? defaultPrice : activePrices.find(usable);
  if (!usable(price)) return null;
  return {
    stripePriceId: price.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
  };
}
