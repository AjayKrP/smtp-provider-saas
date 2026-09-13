import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const planSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    paid: { type: Boolean, required: true, default: false },
    monthlyEmailQuota: { type: Number, required: true },
    maxDomains: { type: Number, required: true },
    maxCredentials: { type: Number, required: true },
    maxMessageSizeBytes: { type: Number, required: true },
    maxRecipientsPerMessage: { type: Number, required: true },
    razorpayItemId: { type: String, default: null },
    // Mirrored from the Razorpay Item by the API's plan catalog sync — never edit by
    // hand. unitAmount is in the currency's minor unit (paise).
    unitAmount: { type: Number, default: null },
    currency: { type: String, default: null },
    priceSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type Plan = InferSchemaType<typeof planSchema> & { _id: Types.ObjectId };
export type PlanDoc = HydratedDocument<Plan>;

export const PlanModel = model('Plan', planSchema);
