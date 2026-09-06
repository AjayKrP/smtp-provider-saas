import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { SUPPRESSION_REASONS } from '../types.js';

const suppressionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    address: { type: String, required: true, lowercase: true, trim: true },
    reason: { type: String, enum: SUPPRESSION_REASONS, required: true },
    smtpResponse: { type: String, default: null },
  },
  { timestamps: true },
);

suppressionSchema.index({ organizationId: 1, address: 1 }, { unique: true });

export type Suppression = InferSchemaType<typeof suppressionSchema> & { _id: Types.ObjectId };
export type SuppressionDoc = HydratedDocument<Suppression>;

export const SuppressionModel = model('Suppression', suppressionSchema);
