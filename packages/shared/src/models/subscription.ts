import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { SUBSCRIPTION_STATUSES } from '../types.js';

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
    stripeCustomerId: { type: String, required: true },
    stripeSubscriptionId: { type: String, default: null, index: true },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type Subscription = InferSchemaType<typeof subscriptionSchema> & { _id: Types.ObjectId };
export type SubscriptionDoc = HydratedDocument<Subscription>;

export const SubscriptionModel = model('Subscription', subscriptionSchema);
