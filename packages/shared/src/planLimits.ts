import { OrganizationModel } from './models/organization.js';
import { PlanModel } from './models/plan.js';
import { SubscriptionModel } from './models/subscription.js';
import { effectivePlanKey } from './billingPeriod.js';
import { planByKey, type PlanDefinition } from './plans.js';
import type { Types } from 'mongoose';

export type EffectivePlan = Omit<PlanDefinition, 'razorpayItemId'>;

/**
 * Limits that apply to an org right now (a lapsed paid plan counts as `free`):
 * DB row first, then the static catalog, then `free`.
 */
export async function getEffectivePlan(
  organizationId: Types.ObjectId | string,
): Promise<EffectivePlan> {
  const [org, sub] = await Promise.all([
    OrganizationModel.findById(organizationId).lean(),
    SubscriptionModel.findOne({ organizationId }).lean(),
  ]);
  const planKey = effectivePlanKey(org?.planKey, sub);

  const dbPlan = await PlanModel.findOne({ key: planKey }).lean();
  if (dbPlan) {
    return {
      key: dbPlan.key,
      name: dbPlan.name,
      paid: dbPlan.paid,
      monthlyEmailQuota: dbPlan.monthlyEmailQuota,
      maxDomains: dbPlan.maxDomains,
      maxCredentials: dbPlan.maxCredentials,
      maxMessageSizeBytes: dbPlan.maxMessageSizeBytes,
      maxRecipientsPerMessage: dbPlan.maxRecipientsPerMessage,
    };
  }
  const { razorpayItemId: _item, ...fallback } = planByKey(planKey) ?? planByKey('free')!;
  return fallback;
}
