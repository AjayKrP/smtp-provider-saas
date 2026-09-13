import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AUTH_TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

/**
 * Single-use emailed link token (email verification, password reset). Only the
 * SHA-256 of the token is stored, so a database leak cannot be replayed as links.
 */
const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: AUTH_TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    // TTL index: MongoDB deletes the row once it has expired.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
authTokenSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

export type AuthToken = InferSchemaType<typeof authTokenSchema> & { _id: Types.ObjectId };
export type AuthTokenDoc = HydratedDocument<AuthToken>;

export const AuthTokenModel = model('AuthToken', authTokenSchema);
