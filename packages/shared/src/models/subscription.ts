import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { SUBSCRIPTION_STATUSES } from '../types.js';

/**
 * An organization's prepaid paid plan. Each Razorpay payment buys one billing period;
 * the plan applies while `currentPeriodEnd` is in the future (or forever when
 * `lifetime`), after which the organization falls back to the free plan's limits
 * (see billingPeriod.ts).
 */
const subscriptionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    planKey: { type: String, required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    // Complimentary access granted by an operator: never expires and cannot be paid for.
    lifetime: { type: Boolean, default: false },
    lastPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  { timestamps: true },
);

export type Subscription = InferSchemaType<typeof subscriptionSchema> & { _id: Types.ObjectId };
export type SubscriptionDoc = HydratedDocument<Subscription>;

export const SubscriptionModel = model('Subscription', subscriptionSchema);
