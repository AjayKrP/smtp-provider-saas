import { describe, expect, it } from 'vitest';
import {
  availableAt,
  checkPayoutEligible,
  commissionFor,
  generateReferralCode,
  normalizeReferralCode,
  summarizeEarnings,
  withholdingFor,
} from './referrals.js';

const HOUR = 60 * 60_000;

describe('commissionFor', () => {
  it('takes the configured percentage of the payment', () => {
    expect(commissionFor(59_900, 10)).toBe(5_990);
    expect(commissionFor(100_000, 10)).toBe(10_000);
  });

  it('rounds down, so a payout can never exceed what was collected', () => {
    // 10% of ₹99.99 is 999.9 paise; paying 999 leaves the fraction behind on purpose.
    expect(commissionFor(9_999, 10)).toBe(999);
    expect(commissionFor(1, 10)).toBe(0);
  });

  it('is zero for a payment that never happened', () => {
    expect(commissionFor(0, 10)).toBe(0);
    expect(commissionFor(-5_000, 10)).toBe(0);
    expect(commissionFor(Number.NaN, 10)).toBe(0);
  });
});

describe('withholdingFor', () => {
  it('rounds up, so under-withholding is never the operator’s problem', () => {
    expect(withholdingFor(999, 5)).toBe(50); // 49.95 -> 50
    expect(withholdingFor(10_000, 5)).toBe(500);
  });

  it('withholds nothing when no rate is configured', () => {
    expect(withholdingFor(10_000, 0)).toBe(0);
  });

  it('never withholds more than the payout itself', () => {
    expect(withholdingFor(100, 150)).toBe(100);
  });
});

describe('normalizeReferralCode', () => {
  it('accepts the code as it is shown', () => {
    expect(normalizeReferralCode('ACDEFGHJ')).toBe('ACDEFGHJ');
  });

  it('accepts a pasted share URL or a lowercased code', () => {
    expect(normalizeReferralCode('https://email4vibecoder.com/r/ACDEFGHJ')).toBe('ACDEFGHJ');
    expect(normalizeReferralCode('  acdefghj  ')).toBe('ACDEFGHJ');
    expect(normalizeReferralCode('/r/ACDE-FGHJ?utm_source=x')).toBe('ACDEFGHJ');
  });

  it('rejects anything that is not a code', () => {
    expect(normalizeReferralCode('')).toBeNull();
    expect(normalizeReferralCode('SHORT')).toBeNull();
    expect(normalizeReferralCode('WAYTOOLONGFORACODE')).toBeNull();
    // B, I, O, S, 0, 1 are excluded from the alphabet as look-alikes.
    expect(normalizeReferralCode('ABCDEFGH')).toBeNull();
    expect(normalizeReferralCode('ACDEFGH0')).toBeNull();
  });

  it('round-trips a generated code', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateReferralCode();
      expect(normalizeReferralCode(code.toLowerCase())).toBe(code);
    }
  });
});

describe('summarizeEarnings', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  const rows = [
    // Held: earned, but still inside the hold window.
    {
      status: 'pending',
      amount: 1_000,
      currency: 'INR',
      availableAt: new Date(now.getTime() + HOUR),
    },
    // Past the hold window: withdrawable.
    {
      status: 'pending',
      amount: 2_000,
      currency: 'INR',
      availableAt: new Date(now.getTime() - HOUR),
    },
    {
      status: 'available',
      amount: 500,
      currency: 'INR',
      availableAt: new Date(now.getTime() - HOUR),
    },
    {
      status: 'claimed',
      amount: 3_000,
      currency: 'INR',
      availableAt: new Date(now.getTime() - HOUR),
    },
    { status: 'paid', amount: 4_000, currency: 'INR', availableAt: new Date(now.getTime() - HOUR) },
    {
      status: 'reversed',
      amount: 9_000,
      currency: 'INR',
      availableAt: new Date(now.getTime() - HOUR),
    },
  ];

  it('separates held earnings from withdrawable ones by time alone', () => {
    const summary = summarizeEarnings(rows, now);
    expect(summary.pending).toBe(1_000);
    expect(summary.available).toBe(2_500);
    expect(summary.claimed).toBe(3_000);
    expect(summary.paid).toBe(4_000);
  });

  it('excludes reversals from lifetime earnings', () => {
    const summary = summarizeEarnings(rows, now);
    expect(summary.reversed).toBe(9_000);
    expect(summary.lifetime).toBe(1_000 + 2_000 + 500 + 3_000 + 4_000);
  });

  it('moves a held commission to available once its hold expires', () => {
    const later = new Date(now.getTime() + 2 * HOUR);
    expect(summarizeEarnings(rows, later).pending).toBe(0);
    expect(summarizeEarnings(rows, later).available).toBe(3_500);
  });

  it('reports zeroes and a currency for an account that has earned nothing', () => {
    const summary = summarizeEarnings([], now);
    expect(summary).toMatchObject({ pending: 0, available: 0, paid: 0, currency: 'INR' });
  });
});

describe('availableAt', () => {
  it('adds the hold window to the payment date', () => {
    expect(availableAt(new Date('2026-09-01T00:00:00Z'), 14).toISOString()).toBe(
      '2026-09-15T00:00:00.000Z',
    );
  });
});

describe('checkPayoutEligible', () => {
  const base = {
    available: 100_000,
    currency: 'INR',
    minimum: 50_000,
    hasPayoutAccount: true,
    hasTaxId: true,
    emailVerified: true,
    openPayout: false,
  };

  it('allows a payout when everything is in place', () => {
    expect(checkPayoutEligible(base).ok).toBe(true);
  });

  it('refuses without a verified email, an account, or a PAN', () => {
    expect(checkPayoutEligible({ ...base, emailVerified: false }).ok).toBe(false);
    expect(checkPayoutEligible({ ...base, hasPayoutAccount: false }).ok).toBe(false);
    expect(checkPayoutEligible({ ...base, hasTaxId: false }).reason).toMatch(/PAN/);
  });

  it('refuses below the minimum and while another payout is open', () => {
    expect(checkPayoutEligible({ ...base, available: 49_999 }).ok).toBe(false);
    expect(checkPayoutEligible({ ...base, openPayout: true }).reason).toMatch(
      /already in progress/,
    );
  });

  it('refuses a currency it cannot transfer', () => {
    expect(checkPayoutEligible({ ...base, currency: 'USD' }).ok).toBe(false);
  });
});
