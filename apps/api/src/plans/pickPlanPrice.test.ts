import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { pickPlanPrice } from './pickPlanPrice.js';

const price = (over: Partial<Stripe.Price> & { id: string }): Stripe.Price =>
  ({
    active: true,
    currency: 'inr',
    unit_amount: 129_900,
    recurring: { interval: 'month' },
    ...over,
  }) as Stripe.Price;

describe('pickPlanPrice', () => {
  it('uses the default price when it is an active recurring price', () => {
    const def = price({ id: 'price_default' });
    expect(pickPlanPrice(def, [price({ id: 'price_other' })])).toEqual({
      stripePriceId: 'price_default',
      unitAmount: 129_900,
      currency: 'inr',
      interval: 'month',
    });
  });

  it('falls back to the newest active recurring price when the default is unusable', () => {
    const oneTime = price({ id: 'price_once', recurring: null });
    const picked = pickPlanPrice(oneTime, [
      price({ id: 'price_once_2', recurring: null }),
      price({ id: 'price_new', unit_amount: 649_900 }),
      price({ id: 'price_old' }),
    ]);
    expect(picked?.stripePriceId).toBe('price_new');
    expect(picked?.unitAmount).toBe(649_900);
  });

  it('ignores archived and custom-amount prices', () => {
    expect(
      pickPlanPrice(price({ id: 'price_archived', active: false }), [
        price({ id: 'price_custom', unit_amount: null }),
      ]),
    ).toBeNull();
  });

  it('returns null when there is no price at all', () => {
    expect(pickPlanPrice(null, [])).toBeNull();
  });
});
