import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Where a referrer's commission is sent, and the tax id it is reported under.
 *
 * The account number and PAN are held encrypted (see crypto.ts) because they are the
 * kind of data that turns a database leak into identity fraud. The last four digits are
 * stored in the clear so the dashboard and support can confirm which account is on file
 * without ever decrypting. Nothing here is logged.
 *
 * IFSC and the holder's name are not encrypted: an IFSC identifies a bank branch, not a
 * person, and the name is already on the account it belongs to.
 */
const payoutAccountSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    /** As printed on the bank account — a transfer is rejected when it does not match. */
    holderName: { type: String, required: true, trim: true },
    accountNumberEncrypted: { type: String, required: true },
    accountNumberLast4: { type: String, required: true },
    ifsc: { type: String, required: true, uppercase: true, trim: true },
    bankName: { type: String, default: null },
    /** Indian tax id. Required before any payout: withholding is reported against it. */
    panEncrypted: { type: String, default: null },
    panLast4: { type: String, default: null },
    /**
     * Set once a payout to this account has actually succeeded. A first transfer is the
     * only real proof the details are right, so this is evidence rather than a checkbox.
     */
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type PayoutAccount = InferSchemaType<typeof payoutAccountSchema> & { _id: Types.ObjectId };
export type PayoutAccountDoc = HydratedDocument<PayoutAccount>;

export const PayoutAccountModel = model('PayoutAccount', payoutAccountSchema);
