import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalised current plan for fast quota checks on the SMTP hot path.
    planKey: { type: String, required: true, default: 'free' },
  },
  { timestamps: true },
);

export type Organization = InferSchemaType<typeof organizationSchema> & { _id: Types.ObjectId };
export type OrganizationDoc = HydratedDocument<Organization>;

export const OrganizationModel = model('Organization', organizationSchema);
