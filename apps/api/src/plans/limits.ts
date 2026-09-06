import { getEffectivePlan, type EffectivePlan } from '@smtp-saas/shared';

export type PlanLimits = EffectivePlan;

/** Effective plan limits for an organization (DB row, then static catalog, then free). */
export const orgPlanLimits = (organizationId: string): Promise<PlanLimits> =>
  getEffectivePlan(organizationId);
