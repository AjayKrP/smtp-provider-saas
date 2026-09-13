import { env } from '../env.js';
import { hmacSha256Matches } from './signatures.js';

const API_BASE = 'https://api.razorpay.com/v1';

export const razorpayConfigured = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

/** A non-2xx response from the Razorpay API, carrying Razorpay's own description. */
export class RazorpayError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export interface RazorpayItem {
  id: string;
  active: boolean;
  name: string;
  amount: number;
  currency: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'attempted' | 'paid';
  notes: Record<string, string>;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!razorpayConfigured) throw new RazorpayError(503, 'Razorpay is not configured');
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; description?: string };
  };
  if (!res.ok) {
    throw new RazorpayError(
      res.status,
      data.error?.description ?? `Razorpay request failed (${res.status})`,
      data.error?.code,
    );
  }
  return data as T;
}

export const fetchItem = (itemId: string) =>
  request<RazorpayItem>('GET', `/items/${encodeURIComponent(itemId)}`);

export const createOrder = (input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}) => request<RazorpayOrder>('POST', '/orders', input);

/** Checkout success callback: hmac_sha256(order_id + "|" + payment_id, key_secret). */
export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string) =>
  hmacSha256Matches(`${orderId}|${paymentId}`, env.RAZORPAY_KEY_SECRET, signature);

/** Webhooks: hmac_sha256(raw request body, webhook secret) in X-Razorpay-Signature. */
export const verifyWebhookSignature = (rawBody: Buffer, signature: string) =>
  hmacSha256Matches(rawBody, env.RAZORPAY_WEBHOOK_SECRET, signature);
