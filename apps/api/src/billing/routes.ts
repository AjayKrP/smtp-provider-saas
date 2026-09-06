import { Router } from 'express';
import { z } from 'zod';
import { OrganizationModel, PlanModel, SubscriptionModel } from '@smtp-saas/shared';
import { env } from '../env.js';
import { ApiError } from '../http/errors.js';
import { validateBody } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';
import { ensureStripeCustomer, stripe } from './stripe.js';

export const billingRouter: Router = Router();
billingRouter.use(requireAuth);

const checkoutSchema = z.object({ planKey: z.string().min(1) });

billingRouter.post('/checkout-session', validateBody(checkoutSchema), async (req, res) => {
  const { organizationId } = auth(req);
  const { planKey } = req.body as z.infer<typeof checkoutSchema>;

  const plan = await PlanModel.findOne({ key: planKey }).lean();
  if (!plan) throw ApiError.notFound('Unknown plan');
  if (plan.priceUsd === 0) throw ApiError.badRequest('The free plan does not require checkout');
  if (!plan.stripePriceId) throw ApiError.badRequest('Plan is not linked to a Stripe price; run the seed script');

  const customerId = await ensureStripeCustomer(organizationId);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.DASHBOARD_URL}/billing?checkout=success`,
    cancel_url: `${env.DASHBOARD_URL}/billing?checkout=cancelled`,
    subscription_data: { metadata: { organizationId } },
    metadata: { organizationId, planKey },
  });
  res.json({ url: session.url });
});

billingRouter.post('/portal-session', async (req, res) => {
  const { organizationId } = auth(req);
  const org = await OrganizationModel.findById(organizationId).lean();
  if (!org?.stripeCustomerId) throw ApiError.badRequest('No billing account yet');
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${env.DASHBOARD_URL}/billing`,
  });
  res.json({ url: session.url });
});

billingRouter.get('/subscription', async (req, res) => {
  const { organizationId } = auth(req);
  const sub = await SubscriptionModel.findOne({ organizationId }).lean();
  res.json(
    sub
      ? {
          planKey: sub.planKey,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : { planKey: 'free', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false },
  );
});
