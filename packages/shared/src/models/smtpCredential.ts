import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const smtpCredentialSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    username: { type: String, required: true, unique: true },
    // argon2id hash of the generated password (shown to the user only once).
    passwordHash: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SmtpCredential = InferSchemaType<typeof smtpCredentialSchema> & { _id: Types.ObjectId };
export type SmtpCredentialDoc = HydratedDocument<SmtpCredential>;

export const SmtpCredentialModel = model('SmtpCredential', smtpCredentialSchema);
