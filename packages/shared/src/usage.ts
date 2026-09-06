import { UsageCounterModel, currentPeriod } from './models/usageCounter.js';
import { PlanModel } from './models/plan.js';
import { OrganizationModel } from './models/organization.js';
import { SubscriptionModel } from './models/subscription.js';
import { SENDING_SUBSCRIPTION_STATUSES } from './types.js';
import { planByKey } from './plans.js';
import type { Types } from 'mongoose';

export interface QuotaSnapshot {
  planKey: string;
  monthlyEmailQuota: number;
  accepted: number;
  remaining: number;
  period: string;
  subscriptionActive: boolean;
}

async function resolvePlanLimits(planKey: string): Promise<{ monthlyEmailQuota: number }> {
  const dbPlan = await PlanModel.findOne({ key: planKey }).lean();
  if (dbPlan) return { monthlyEmailQuota: dbPlan.monthlyEmailQuota };
  const fallback = planByKey(planKey) ?? planByKey('free')!;
  return { monthlyEmailQuota: fallback.monthlyEmailQuota };
}

export async function getQuotaSnapshot(
  organizationId: Types.ObjectId | string,
): Promise<QuotaSnapshot> {
  const period = currentPeriod();
  const [org, sub, counter] = await Promise.all([
    OrganizationModel.findById(organizationId).lean(),
    SubscriptionModel.findOne({ organizationId }).lean(),
    UsageCounterModel.findOne({ organizationId, period }).lean(),
  ]);

  const planKey = org?.planKey ?? 'free';
  const { monthlyEmailQuota } = await resolvePlanLimits(planKey);
  const accepted = counter?.accepted ?? 0;

  // The free plan needs no subscription row; paid plans must be in a sending state.
  const subscriptionActive =
    planKey === 'free' ||
    (!!sub && SENDING_SUBSCRIPTION_STATUSES.includes(sub.status));

  return {
    planKey,
    monthlyEmailQuota,
    accepted,
    remaining: Math.max(0, monthlyEmailQuota - accepted),
    period,
    subscriptionActive,
  };
}

/**
 * Atomically reserve `count` messages against this month's quota.
 * Returns false (and reserves nothing) if it would exceed the plan limit.
 */
export async function reserveQuota(
  organizationId: Types.ObjectId | string,
  monthlyEmailQuota: number,
  count = 1,
): Promise<boolean> {
  const period = currentPeriod();
  const res = await UsageCounterModel.findOneAndUpdate(
    { organizationId, period, accepted: { $lte: monthlyEmailQuota - count } },
    { $inc: { accepted: count }, $setOnInsert: { organizationId, period } },
    { upsert: true, new: true },
  ).catch((err: unknown) => {
    // Upsert race: a concurrent insert created the row. Retry once as a plain update.
    if ((err as { code?: number }).code === 11000) return null;
    throw err;
  });
  if (res) return true;

  const retry = await UsageCounterModel.updateOne(
    { organizationId, period, accepted: { $lte: monthlyEmailQuota - count } },
    { $inc: { accepted: count } },
  );
  return retry.modifiedCount > 0;
}

export async function incrementUsage(
  organizationId: Types.ObjectId | string,
  field: 'delivered' | 'bounced' | 'failed',
  count = 1,
): Promise<void> {
  const period = currentPeriod();
  await UsageCounterModel.updateOne(
    { organizationId, period },
    { $inc: { [field]: count }, $setOnInsert: { organizationId, period } },
    { upsert: true },
  );
}
