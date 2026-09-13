import { Router } from 'express';
import { UsageCounterModel, currentPeriod, getQuotaSnapshot } from '@smtp-saas/shared';
import { auth, requireAuth } from '../auth/middleware.js';
import { orgPlanLimits } from '../plans/limits.js';

export const usageRouter: Router = Router();
usageRouter.use(requireAuth);

usageRouter.get('/current', async (req, res) => {
  const { organizationId } = auth(req);
  const period = currentPeriod();
  const [snapshot, limits, counter] = await Promise.all([
    getQuotaSnapshot(organizationId),
    orgPlanLimits(organizationId),
    UsageCounterModel.findOne({ organizationId, period }).lean(),
  ]);

  res.json({
    period,
    planKey: snapshot.planKey,
    planName: limits.name,
    planExpired: snapshot.planExpired,
    monthlyEmailQuota: snapshot.monthlyEmailQuota,
    accepted: snapshot.accepted,
    remaining: snapshot.remaining,
    delivered: counter?.delivered ?? 0,
    bounced: counter?.bounced ?? 0,
    failed: counter?.failed ?? 0,
  });
});
