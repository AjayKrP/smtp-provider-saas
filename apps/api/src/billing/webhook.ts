import { Router, raw } from 'express';
import { logger } from '@smtp-saas/shared';
import { fulfillOrder } from './fulfill.js';
import { verifyWebhookSignature } from './razorpay.js';

interface RazorpayWebhook {
  event: string;
  payload: {
    order?: { entity: { id: string } };
    payment?: { entity: { id: string; order_id: string | null } };
  };
}

/**
 * Mounted at /webhooks/razorpay with a raw body parser (the signature covers the exact
 * bytes). Must be registered before express.json().
 *
 * Backstop for the checkout callback: if the customer closes the tab after paying,
 * `order.paid` still credits the plan. The Razorpay account is shared with other
 * sites, so orders we did not create are acknowledged and ignored.
 */
export const razorpayWebhookRouter: Router = Router();

razorpayWebhookRouter.post('/', raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) {
    res.status(400).send('missing signature');
    return;
  }
  if (!verifyWebhookSignature(req.body, signature)) {
    logger.warn('razorpay webhook signature verification failed');
    res.status(400).send('invalid signature');
    return;
  }

  const event = JSON.parse(req.body.toString('utf8')) as RazorpayWebhook;
  try {
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const payment = event.payload.payment?.entity;
      const orderId = event.payload.order?.entity.id ?? payment?.order_id;
      if (orderId && payment) await fulfillOrder(orderId, payment.id);
    }
  } catch (err) {
    logger.error({ err, event: event.event }, 'razorpay webhook handler failed');
    res.status(500).send('handler error');
    return;
  }

  res.json({ received: true });
});
