import { OrganizationModel } from './models/organization.js';
import { PlanModel } from './models/plan.js';
import { planByKey, type PlanDefinition } from './plans.js';
import type { Types } from 'mongoose';

export type EffectivePlan = PlanDefinition & { stripePriceId: string | null };

/** Effective plan limits for an org: DB row first, then the static catalog, then `free`. */
export async function getEffectivePlan(
  organizationId: Types.ObjectId | string,
): Promise<EffectivePlan> {
  const org = await OrganizationModel.findById(organizationId).lean();
  const planKey = org?.planKey ?? 'free';

  const dbPlan = await PlanModel.findOne({ key: planKey }).lean();
  if (dbPlan) {
    return {
      key: dbPlan.key,
      name: dbPlan.name,
      monthlyEmailQuota: dbPlan.monthlyEmailQuota,
      maxDomains: dbPlan.maxDomains,
      maxCredentials: dbPlan.maxCredentials,
      maxMessageSizeBytes: dbPlan.maxMessageSizeBytes,
      maxRecipientsPerMessage: dbPlan.maxRecipientsPerMessage,
      stripeProductId: dbPlan.stripeProductId ?? undefined,
      stripePriceId: dbPlan.stripePriceId ?? null,
    };
  }
  const fallback = planByKey(planKey) ?? planByKey('free')!;
  return { ...fallback, stripePriceId: null };
}
