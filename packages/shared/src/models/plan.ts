import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const planSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    priceUsd: { type: Number, required: true },
    monthlyEmailQuota: { type: Number, required: true },
    maxDomains: { type: Number, required: true },
    maxCredentials: { type: Number, required: true },
    maxMessageSizeBytes: { type: Number, required: true },
    maxRecipientsPerMessage: { type: Number, required: true },
    stripeProductId: { type: String, default: null },
    stripePriceId: { type: String, default: null },
  },
  { timestamps: true },
);

export type Plan = InferSchemaType<typeof planSchema> & { _id: Types.ObjectId };
export type PlanDoc = HydratedDocument<Plan>;

export const PlanModel = model('Plan', planSchema);
