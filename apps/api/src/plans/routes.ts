import { Router } from 'express';
import { PLAN_KEYS, PlanModel } from '@smtp-saas/shared';

export const plansRouter: Router = Router();

plansRouter.get('/', async (_req, res) => {
  const plans = await PlanModel.find({ key: { $in: PLAN_KEYS } }).lean();
  // Catalog order (free → paid tiers), not price order: prices may differ in currency.
  plans.sort((a, b) => PLAN_KEYS.indexOf(a.key) - PLAN_KEYS.indexOf(b.key));
  res.json(
    plans.map((p) => {
      const paid = !!p.stripeProductId;
      return {
        key: p.key,
        name: p.name,
        monthlyEmailQuota: p.monthlyEmailQuota,
        maxDomains: p.maxDomains,
        maxCredentials: p.maxCredentials,
        maxRecipientsPerMessage: p.maxRecipientsPerMessage,
        requiresCheckout: paid,
        // null for the free plan, and for a paid plan whose Stripe price is missing.
        price:
          paid && p.stripePriceId && p.unitAmount !== null && p.currency
            ? { unitAmount: p.unitAmount, currency: p.currency, interval: p.interval ?? 'month' }
            : null,
      };
    }),
  );
});
