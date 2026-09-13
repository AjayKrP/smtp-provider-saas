import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
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

export type User = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
