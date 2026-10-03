import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /**
     * Absent for an account that only ever signed in with Google. Every password check
     * must therefore handle its absence rather than assume a hash is there.
     */
    passwordHash: { type: String, default: null },
    /**
     * Google's stable subject id for this person. It is the join key, not the email:
     * Google addresses can change, the subject cannot.
     */
    googleSub: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Login is refused until the address is confirmed via the emailed link.
    emailVerifiedAt: { type: Date, default: null },
    // Embedded in refresh tokens; bumping it (e.g. on password reset) signs out every session.
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Unique among the accounts that have a Google identity, indifferent to those that do
// not: only string values are indexed, so the nulls never collide.
userSchema.index(
  { googleSub: 1 },
  { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } },
);

export type User = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
