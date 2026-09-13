import { Router, raw } from 'express';
import type Stripe from 'stripe';
import { logger } from '@smtp-saas/shared';
import { env } from '../env.js';
import { markSubscriptionCanceled, stripe, syncSubscription } from './stripe.js';
import { syncPlanCatalog } from '../plans/catalog.js';

/**
 * Mounted at /webhooks/stripe with a raw body parser (Stripe signature verification
 * needs the exact bytes). Must be registered before express.json().
 */
export const stripeWebhookRouter: Router = Router();

stripeWebhookRouter.post('/', raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).send('missing signature');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'stripe webhook signature verification failed');
    res.status(400).send('invalid signature');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const subId =
          'subscription' in obj && obj.subscription
            ? (obj.subscription as string)
            : (obj as Stripe.Subscription).id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        await markSubscriptionCanceled((event.data.object as Stripe.Subscription).id);
        break;
      }
      case 'product.created':
      case 'product.updated':
      case 'product.deleted':
      case 'price.created':
      case 'price.updated':
      case 'price.deleted': {
        await syncPlanCatalog();
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, 'stripe webhook handler failed');
    res.status(500).send('handler error');
    return;
  }

  res.json({ received: true });
});
