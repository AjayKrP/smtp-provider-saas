import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** One document per organization per calendar month (UTC). */
const usageCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    period: { type: String, required: true }, // "YYYY-MM"
    accepted: { type: Number, default: 0 }, // messages accepted at SMTP ingress
    delivered: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { timestamps: true },
);

usageCounterSchema.index({ organizationId: 1, period: 1 }, { unique: true });

export type UsageCounter = InferSchemaType<typeof usageCounterSchema> & { _id: Types.ObjectId };
export type UsageCounterDoc = HydratedDocument<UsageCounter>;

export const UsageCounterModel = model('UsageCounter', usageCounterSchema);

export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
