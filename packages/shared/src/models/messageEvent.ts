import { Schema, model, type Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { MESSAGE_EVENT_TYPES } from '../types.js';

const messageEventSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: MESSAGE_EVENT_TYPES, required: true },
    recipient: { type: String, default: null },
    mxHost: { type: String, default: null },
    smtpCode: { type: Number, default: null },
    smtpResponse: { type: String, default: null },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

messageEventSchema.index({ messageId: 1, at: 1 });

export type MessageEvent = InferSchemaType<typeof messageEventSchema> & { _id: Types.ObjectId };
export type MessageEventDoc = HydratedDocument<MessageEvent>;

export const MessageEventModel = model('MessageEvent', messageEventSchema);
