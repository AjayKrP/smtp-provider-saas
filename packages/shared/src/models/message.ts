import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { MESSAGE_STATUSES } from '../types.js';

const recipientSchema = new Schema(
  {
    address: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'queued' },
    smtpCode: { type: Number, default: null },
    smtpResponse: { type: String, default: null },
    mxHost: { type: String, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    credentialId: { type: Schema.Types.ObjectId, ref: 'SmtpCredential', required: true },
    // RFC 5322 Message-ID (generated if the client omitted one).
    messageId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    envelopeFrom: { type: String, required: true },
    to: { type: [recipientSchema], required: true },
    subject: { type: String, default: '' },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    // GridFS file id for the raw MIME (raw_messages bucket).
    rawRef: { type: Schema.Types.ObjectId, required: true },
    queuedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

messageSchema.index({ organizationId: 1, createdAt: -1 });

export type Message = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId };
export type MessageDoc = HydratedDocument<Message>;

export const MessageModel = model('Message', messageSchema);
