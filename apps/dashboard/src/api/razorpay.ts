import { BRAND } from '../components/bits.js';

/** Options returned by POST /billing/checkout. */
export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
  prefill: { name: string; email: string };
}

/** Razorpay Checkout's success payload; POST it to /billing/verify. */
export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Thrown when the customer closes Checkout without paying — not an error to show. */
export class CheckoutDismissed extends Error {
  constructor() {
    super('Checkout closed');
  }
}

let loader: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loader = null;
      script.remove();
      reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loader;
}

/**
 * Open Razorpay Checkout for an order. Resolves once a payment succeeds. Failed
 * attempts stay inside the Checkout modal (the customer can retry another method);
 * closing it rejects with CheckoutDismissed.
 */
export async function openCheckout(order: CheckoutOrder): Promise<CheckoutSuccess> {
  await loadCheckoutScript();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: BRAND,
      description: `${order.planName} plan — 1 month`,
      prefill: order.prefill,
      theme: { color: '#4f46e5' },
      handler: (response: CheckoutSuccess) => resolve(response),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    });
    checkout.open();
  });
}
