import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { COMMISSION_STATUSES } from '../types.js';

/**
 * One referrer's cut of one payment made by one organization they referred.
 *
 * `paymentId` is unique, which is what makes awarding a commission idempotent: the
 * checkout callback and the `order.paid` webhook both credit the same payment, and the
 * second one loses the insert rather than paying twice.
 *
 * Amounts are integers in the payment's minor unit (paise for INR).
 */
const referralCommissionSchema = new Schema(
  {
    referrerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    refereeOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    /** What the referee actually paid, for the audit trail behind the percentage. */
    grossAmount: { type: Number, required: true },
    percent: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: COMMISSION_STATUSES, required: true, default: 'pending' },
    /**
     * When it leaves the hold window and becomes withdrawable. The hold exists so a
     * refunded or charged-back payment can be reversed before the money is gone.
     */
    availableAt: { type: Date, required: true },
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', default: null, index: true },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: null },
  },
  { timestamps: true },
);

referralCommissionSchema.index({ referrerOrganizationId: 1, status: 1, availableAt: 1 });

export type ReferralCommission = InferSchemaType<typeof referralCommissionSchema> & {
  _id: Types.ObjectId;
};
export type ReferralCommissionDoc = HydratedDocument<ReferralCommission>;

export const ReferralCommissionModel = model('ReferralCommission', referralCommissionSchema);
