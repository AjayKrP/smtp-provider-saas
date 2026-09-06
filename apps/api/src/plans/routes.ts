import { Router } from 'express';
import { PlanModel } from '@smtp-saas/shared';

export const plansRouter: Router = Router();

plansRouter.get('/', async (_req, res) => {
  const plans = await PlanModel.find().sort({ priceUsd: 1 }).lean();
  res.json(
    plans.map((p) => ({
      key: p.key,
      name: p.name,
      priceUsd: p.priceUsd,
      monthlyEmailQuota: p.monthlyEmailQuota,
      maxDomains: p.maxDomains,
      maxCredentials: p.maxCredentials,
      maxRecipientsPerMessage: p.maxRecipientsPerMessage,
      requiresCheckout: p.priceUsd > 0,
    })),
  );
});
