import { logger } from '@smtp-saas/shared';
import { env } from '../env.js';
import { RazorpayError } from './razorpay.js';

/**
 * RazorpayX payouts: sending referral commission to a referrer's bank account.
 *
 * Separate from razorpay.ts because this moves money *out*. It uses its own credentials
 * when given them (RazorpayX can be a distinct key pair) and falls back to the main
 * Razorpay keys, which is what works when RazorpayX is enabled on the same account.
 *
 * A transfer is three calls: a contact (who), a fund account (where), then the payout
 * (how much). Contacts and fund accounts are reusable, but creating them per payout keeps
 * this stateless — RazorpayX deduplicates neither, so the cost is a little clutter in
 * their dashboard rather than a correctness problem.
 */
const API_BASE = 'https://api.razorpay.com/v1';

const keyId = () => env.RAZORPAYX_KEY_ID ?? env.RAZORPAY_KEY_ID;
const keySecret = () => env.RAZORPAYX_KEY_SECRET ?? env.RAZORPAY_KEY_SECRET;

/** Payouts need the source account number as well as credentials, hence three checks. */
export const razorpayxConfigured = !!(
  env.RAZORPAYX_ACCOUNT_NUMBER &&
  (env.RAZORPAYX_KEY_ID ?? env.RAZORPAY_KEY_ID) &&
  (env.RAZORPAYX_KEY_SECRET ?? env.RAZORPAY_KEY_SECRET)
);

interface RazorpayxContact {
  id: string;
}
interface RazorpayxFundAccount {
  id: string;
}
interface RazorpayxPayout {
  id: string;
  status: string;
  amount: number;
}

async function request<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  if (!razorpayxConfigured) throw new RazorpayError(503, 'RazorpayX is not configured');
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
  // Only the payout call accepts this, and it is what stops a retry paying twice.
  if (idempotencyKey) headers['X-Payout-Idempotency'] = idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; description?: string };
  };
  if (!res.ok) {
    throw new RazorpayError(
      res.status,
      data.error?.description ?? `RazorpayX request failed (${res.status})`,
      data.error?.code,
    );
  }
  return data as T;
}

/** RazorpayX considers a payout done at `processed`; everything else is in flight. */
const SETTLED = 'processed';

export async function createRazorpayxPayout(input: {
  amount: number;
  currency: string;
  referenceId: string;
  holderName: string;
  accountNumber: string;
  ifsc: string;
}): Promise<{ payoutId: string; fundAccountId: string; settled: boolean }> {
  const contact = await request<RazorpayxContact>('/contacts', {
    name: input.holderName,
    type: 'vendor',
    reference_id: `referral_${input.referenceId}`,
  });

  const fundAccount = await request<RazorpayxFundAccount>('/fund_accounts', {
    contact_id: contact.id,
    account_type: 'bank_account',
    bank_account: {
      name: input.holderName,
      ifsc: input.ifsc,
      account_number: input.accountNumber,
    },
  });

  const payout = await request<RazorpayxPayout>(
    '/payouts',
    {
      account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.id,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      // IMPS is immediate and works around the clock; RazorpayX falls back to NEFT
      // itself when a beneficiary bank cannot take IMPS.
      mode: 'IMPS',
      purpose: 'payout',
      // Hold it rather than fail it when the RazorpayX balance is short: an operator can
      // top up and the queued payout goes through, instead of the request being lost.
      queue_if_low_balance: true,
      reference_id: input.referenceId,
      narration: 'Referral commission',
    },
    input.referenceId,
  );

  logger.info(
    { payout: payout.id, status: payout.status, amount: payout.amount },
    'razorpayx payout created',
  );

  return {
    payoutId: payout.id,
    fundAccountId: fundAccount.id,
    settled: payout.status === SETTLED,
  };
}

/** Map a RazorpayX payout status onto ours, for the webhook and for polling. */
export function payoutStatusFrom(razorpayxStatus: string): 'paid' | 'failed' | 'processing' {
  if (razorpayxStatus === SETTLED) return 'paid';
  if (['reversed', 'cancelled', 'rejected', 'failed'].includes(razorpayxStatus)) return 'failed';
  return 'processing';
}
