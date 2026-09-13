import { describe, expect, it } from 'vitest';
import { addOneMonth, effectivePlanKey, nextBillingPeriod } from './billingPeriod.js';

const now = new Date('2026-09-13T10:00:00Z');
const active = (planKey: string, end: string) => ({
  planKey,
  status: 'active' as const,
  currentPeriodEnd: new Date(end),
});

describe('addOneMonth', () => {
  it('keeps the day of month', () => {
    expect(addOneMonth(new Date('2026-09-13T10:00:00Z')).toISOString()).toBe(
      '2026-10-13T10:00:00.000Z',
    );
  });

  it('clamps to the last day of shorter months', () => {
    expect(addOneMonth(new Date('2026-01-31T00:00:00Z')).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addOneMonth(new Date('2028-01-31T00:00:00Z')).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('rolls over the year', () => {
    expect(addOneMonth(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    );
  });
});

describe('effectivePlanKey', () => {
  it('is free for the free plan or no subscription', () => {
    expect(effectivePlanKey('free', null, now)).toBe('free');
    expect(effectivePlanKey('starter', null, now)).toBe('free');
  });

  it('grants the paid plan while its period lasts', () => {
    expect(effectivePlanKey('starter', active('starter', '2026-10-01T00:00:00Z'), now)).toBe(
      'starter',
    );
  });

  it('falls back to free once the period has ended or was canceled', () => {
    expect(effectivePlanKey('starter', active('starter', '2026-09-01T00:00:00Z'), now)).toBe(
      'free',
    );
    expect(
      effectivePlanKey(
        'starter',
        { ...active('starter', '2026-10-01T00:00:00Z'), status: 'canceled' },
        now,
      ),
    ).toBe('free');
  });
});

describe('nextBillingPeriod', () => {
  it('starts now for a first purchase', () => {
    const { start, end } = nextBillingPeriod(null, 'starter', now);
    expect(start).toEqual(now);
    expect(end.toISOString()).toBe('2026-10-13T10:00:00.000Z');
  });

  it('extends a running period of the same plan from its end', () => {
    const { start, end } = nextBillingPeriod(
      active('starter', '2026-09-20T00:00:00Z'),
      'starter',
      now,
    );
    expect(start.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('starts now when switching plans or renewing after expiry', () => {
    expect(
      nextBillingPeriod(active('starter', '2026-09-20T00:00:00Z'), 'growth', now).start,
    ).toEqual(now);
    expect(
      nextBillingPeriod(active('starter', '2026-09-01T00:00:00Z'), 'starter', now).start,
    ).toEqual(now);
  });
});
