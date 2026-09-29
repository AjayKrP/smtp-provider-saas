/**
 * Referral program arithmetic and code handling.
 *
 * Kept pure and free of Mongoose so the money math can be tested directly: every amount
 * here is an integer in the minor currency unit (paise for INR), exactly as Razorpay
 * charges and pays. Floating point never touches a commission.
 */

/**
 * Code alphabet without the characters people mistake for each other when reading a code
 * off a screen or hearing it over a call: 0/O, 1/I/L, 2/Z, 5/S, 8/B.
 */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3467';
const CODE_LENGTH = 8;

export function generateReferralCode(random: (max: number) => number = randomIndex): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return code;
}

function randomIndex(max: number): number {
  // Rejection-free is not needed here: a referral code is not a secret, only unguessable
  // enough that nobody stumbles onto someone else's.
  return Math.floor(Math.random() * max);
}

/**
 * Accept a code however it arrives — pasted with spaces, lowercased, or as a whole
 * referral URL — and return the canonical form, or null if nothing usable is left.
 */
export function normalizeReferralCode(input: string): string | null {
  // Drop a query string or fragment before taking the last path segment: a tracking
  // parameter on a shared link would otherwise be read as the code.
  const withoutQuery = input.trim().split(/[?#]/)[0] ?? '';
  const tail = withoutQuery.split('/').filter(Boolean).pop() ?? '';
  const cleaned = tail.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  if (![...cleaned].every((ch) => CODE_ALPHABET.includes(ch))) return null;
  return cleaned;
}

/**
 * The referrer's cut of one payment, rounded down to the paisa.
 *
 * Rounding down is deliberate: rounding up would, across many small payments, pay out
 * marginally more than was collected, and the missing fraction of a paisa is not
 * something anyone can spend.
 */
export function commissionFor(grossAmount: number, percent: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0;
  return Math.floor((grossAmount * percent) / 100);
}

/**
 * Tax withheld at source from a payout, rounded up to the paisa.
 *
 * Rounded the other way from a commission, and for the same reason: under-withholding is
 * the operator's liability, so any fraction belongs on the tax side of the split.
 */
export function withholdingFor(grossAmount: number, percent: number): number {
  if (percent <= 0 || grossAmount <= 0) return 0;
  return Math.min(grossAmount, Math.ceil((grossAmount * percent) / 100));
}

/** When a commission stops being reversible and becomes withdrawable. */
export function availableAt(paidAt: Date, holdDays: number): Date {
  return new Date(paidAt.getTime() + holdDays * 24 * 60 * 60_000);
}

export interface CommissionRow {
  status: string;
  amount: number;
  currency: string;
  availableAt: Date | null;
}

export interface EarningsSummary {
  /** Earned, still inside the hold window: cannot be withdrawn yet. */
  pending: number;
  /** Past the hold window and not yet claimed by a payout. */
  available: number;
  /** Inside a payout that has been requested but not settled. */
  claimed: number;
  /** Actually paid out, all time. */
  paid: number;
  /** Cancelled because the underlying payment was refunded. */
  reversed: number;
  /** All time, excluding reversals: what the program has earned them. */
  lifetime: number;
  currency: string;
}

/**
 * Turn a referrer's commission rows into the five numbers the dashboard shows.
 *
 * `pending` and `available` differ only by the hold window, which is why this takes
 * `now`: a commission becomes withdrawable with the passage of time, not with a write.
 */
export function summarizeEarnings(
  rows: CommissionRow[],
  now: Date = new Date(),
  fallbackCurrency = 'INR',
): EarningsSummary {
  const summary: EarningsSummary = {
    pending: 0,
    available: 0,
    claimed: 0,
    paid: 0,
    reversed: 0,
    lifetime: 0,
    currency: rows[0]?.currency?.toUpperCase() ?? fallbackCurrency,
  };

  for (const row of rows) {
    if (row.status === 'reversed' || row.status === 'cancelled') {
      summary.reversed += row.amount;
      continue;
    }
    summary.lifetime += row.amount;
    if (row.status === 'paid') summary.paid += row.amount;
    else if (row.status === 'claimed') summary.claimed += row.amount;
    else if (row.availableAt && row.availableAt.getTime() <= now.getTime()) {
      summary.available += row.amount;
    } else {
      summary.pending += row.amount;
    }
  }

  return summary;
}

export interface PayoutEligibility {
  ok: boolean;
  /** Why not, in words a customer can act on. */
  reason?: string;
}

/**
 * Whether a referrer may request a payout right now. Every condition here exists to stop
 * money leaving on a transfer that would fail, be clawed back, or be untaxable.
 */
export function checkPayoutEligible(input: {
  available: number;
  currency: string;
  minimum: number;
  hasPayoutAccount: boolean;
  hasTaxId: boolean;
  emailVerified: boolean;
  openPayout: boolean;
}): PayoutEligibility {
  if (!input.emailVerified) return { ok: false, reason: 'Verify your email address first.' };
  if (input.openPayout) {
    return { ok: false, reason: 'A payout is already in progress. It must settle first.' };
  }
  if (!input.hasPayoutAccount) {
    return { ok: false, reason: 'Add the bank account the payout should go to.' };
  }
  if (!input.hasTaxId) {
    return { ok: false, reason: 'Add your PAN — payouts cannot be made without it.' };
  }
  if (input.currency.toUpperCase() !== 'INR') {
    return { ok: false, reason: 'Payouts are only available in INR. Contact support.' };
  }
  if (input.available < input.minimum) return { ok: false, reason: 'Below the payout minimum.' };
  return { ok: true };
}
