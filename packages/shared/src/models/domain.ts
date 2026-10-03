import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { DOMAIN_STATUSES } from '../types.js';

const domainSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    domain: { type: String, required: true, lowercase: true, trim: true },
    dkimSelector: { type: String, required: true },
    // AES-256-GCM encrypted PKCS#8 PEM (see shared/crypto).
    dkimPrivateKeyEnc: { type: String, required: true },
    dkimPublicKey: { type: String, required: true },
    status: { type: String, enum: DOMAIN_STATUSES, default: 'pending' },
    spfVerified: { type: Boolean, default: false },
    dkimVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    /**
     * Which DNS host answers for this zone, so the dashboard can give instructions for
     * the screen the customer is looking at. Detected when the domain is added and
     * refreshed on every verification attempt — a domain that moves provider mid-setup
     * would otherwise keep being told about the old one. Null means unrecognised, which
     * is a normal answer and falls back to generic instructions.
     */
    dnsProvider: { type: String, default: null },
    nameservers: { type: [String], default: [] },
  },
  { timestamps: true },
);

domainSchema.index({ organizationId: 1, domain: 1 }, { unique: true });

export type Domain = InferSchemaType<typeof domainSchema> & { _id: Types.ObjectId };
export type DomainDoc = HydratedDocument<Domain>;

export const DomainModel = model('Domain', domainSchema);
