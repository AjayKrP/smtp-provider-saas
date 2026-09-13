import { Router } from 'express';
import { PLAN_KEYS, PlanModel } from '@smtp-saas/shared';

export const plansRouter: Router = Router();

plansRouter.get('/', async (_req, res) => {
  const plans = await PlanModel.find({ key: { $in: PLAN_KEYS } }).lean();
  // Catalog order (free → paid tiers), not price order.
  plans.sort((a, b) => PLAN_KEYS.indexOf(a.key) - PLAN_KEYS.indexOf(b.key));
  res.json(
    plans.map((p) => ({
      key: p.key,
      name: p.name,
      monthlyEmailQuota: p.monthlyEmailQuota,
      maxDomains: p.maxDomains,
      maxCredentials: p.maxCredentials,
      maxRecipientsPerMessage: p.maxRecipientsPerMessage,
      requiresCheckout: p.paid,
      // One payment buys one month. null for the free plan, and for a paid plan whose
      // Razorpay Item is missing or inactive.
      price:
        p.paid && p.razorpayItemId && typeof p.unitAmount === 'number' && p.currency
          ? { unitAmount: p.unitAmount, currency: p.currency, interval: 'month' }
          : null,
    })),
  );
});
