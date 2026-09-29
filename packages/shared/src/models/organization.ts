import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalised current plan for fast quota checks on the SMTP hot path.
    planKey: { type: String, required: true, default: 'free' },
    /**
     * This organization's own referral code, handed out in its share link. Minted on first
     * use rather than at signup, so accounts that predate the program have none until they
     * open the referrals page. Uniqueness comes from the partial index below, not from
     * `unique` here: a sparse unique index still indexes an explicit null, so every
     * organization without a code yet would collide with every other one.
     */
    referralCode: { type: String, default: null, uppercase: true },
    /**
     * Who referred this organization, captured at signup and never changed afterwards:
     * attribution that could move would be attribution anyone could argue with.
     */
    referredByOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    referredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Unique across the codes that exist, and indifferent to the organizations that have
// none: only string values are indexed, so the nulls never collide with each other.
organizationSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: 'string' } } },
);

export type Organization = InferSchemaType<typeof organizationSchema> & { _id: Types.ObjectId };
export type OrganizationDoc = HydratedDocument<Organization>;

export const OrganizationModel = model('Organization', organizationSchema);
