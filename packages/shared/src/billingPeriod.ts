import type { SubscriptionStatus } from './types.js';

interface SubscriptionState {
  planKey: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

/** Same day next month, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function addOneMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Whether a prepaid subscription currently grants its plan. */
export function isSubscriptionCurrent(
  sub: SubscriptionState | null | undefined,
  now = new Date(),
): sub is SubscriptionState & { currentPeriodEnd: Date } {
  return !!sub && sub.status === 'active' && !!sub.currentPeriodEnd && sub.currentPeriodEnd > now;
}

/**
 * The plan whose limits apply right now: the organization's paid plan while its
 * prepaid period lasts, otherwise the free plan. Expiry downgrades limits rather
 * than blocking sending.
 */
export function effectivePlanKey(
  orgPlanKey: string | null | undefined,
  sub: SubscriptionState | null | undefined,
  now = new Date(),
): string {
  if (!orgPlanKey || orgPlanKey === 'free') return 'free';
  return isSubscriptionCurrent(sub, now) && sub.planKey === orgPlanKey ? orgPlanKey : 'free';
}

/**
 * The period a new payment for `planKey` buys. Renewing the plan that is still
 * running extends it from its current end; buying a different plan, or buying after
 * expiry, starts a fresh period now.
 */
export function nextBillingPeriod(
  sub: SubscriptionState | null | undefined,
  planKey: string,
  now = new Date(),
): { start: Date; end: Date } {
  const start =
    isSubscriptionCurrent(sub, now) && sub.planKey === planKey ? sub.currentPeriodEnd : now;
  return { start, end: addOneMonth(start) };
}
