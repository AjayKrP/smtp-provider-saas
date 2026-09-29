import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYOUT_STATUSES } from '../types.js';

/**
 * One transfer of accumulated commission to one referrer.
 *
 * A payout claims a set of commissions when it is requested (`claimed` status on each),
 * so the same earnings can never be in two payouts. If it fails or is cancelled, those
 * commissions go back to being available.
 *
 * gross = the claimed commissions; net = what actually leaves the account after tax
 * withholding. Both are stored rather than recomputed, because the withholding rate can
 * change between one payout and the next and a past payout must still add up.
 */
const payoutSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    grossAmount: { type: Number, required: true },
    withheldAmount: { type: Number, required: true, default: 0 },
    withheldPercent: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: PAYOUT_STATUSES, required: true, default: 'requested' },
    /** Snapshot of where it went, so the record stands even if the account is changed later. */
    destination: {
      holderName: { type: String, default: null },
      accountNumberLast4: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
    /** RazorpayX ids, once a transfer has been attempted. */
    razorpayxPayoutId: { type: String, default: null },
    razorpayxFundAccountId: { type: String, default: null },
    /** Set when an operator settles a payout by hand instead of through RazorpayX. */
    manualReference: { type: String, default: null },
    failureReason: { type: String, default: null },
    requestedAt: { type: Date, default: Date.now },
    settledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payoutSchema.index({ status: 1, requestedAt: 1 });

export type Payout = InferSchemaType<typeof payoutSchema> & { _id: Types.ObjectId };
export type PayoutDoc = HydratedDocument<Payout>;

export const PayoutModel = model('Payout', payoutSchema);
