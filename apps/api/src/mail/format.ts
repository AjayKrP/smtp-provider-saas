// Stripe/Razorpay-style minor units (paise, cents); these currencies have none.
const ZERO_DECIMAL = new Set(['jpy', 'krw', 'vnd', 'clp', 'ugx', 'xaf', 'xof']);

/** e.g. (59900, 'inr') → "₹599.00" */
export function formatMoney(unitAmount: number, currency: string, { whole = false } = {}): string {
  const code = currency.toLowerCase();
  const major = ZERO_DECIMAL.has(code) ? unitAmount : unitAmount / 100;
  const digits = whole && Number.isInteger(major) ? 0 : 2;
  return new Intl.NumberFormat(code === 'inr' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: code.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
}

/** e.g. "13 Oct 2026" — emails have no viewer locale or time zone, so fix both. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}
