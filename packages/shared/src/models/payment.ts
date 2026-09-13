import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAYMENT_STATUSES } from '../types.js';

/** One Razorpay Order for one billing period of a paid plan. */
const paymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    planKey: { type: String, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'created' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: null },
    // Minor currency unit (paise), as charged by Razorpay.
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    // The period this payment bought; set when it is marked paid.
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type Payment = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export type PaymentDoc = HydratedDocument<Payment>;

export const PaymentModel = model('Payment', paymentSchema);
