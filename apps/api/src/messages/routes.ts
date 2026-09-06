import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { MESSAGE_STATUSES, MessageEventModel, MessageModel } from '@smtp-saas/shared';
import { ApiError } from '../http/errors.js';
import { validateQuery, parsedQuery } from '../http/validate.js';
import { auth, requireAuth } from '../auth/middleware.js';

export const messagesRouter: Router = Router();
messagesRouter.use(requireAuth);

const listSchema = z.object({
  status: z.enum(MESSAGE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  before: z.string().optional(), // message _id cursor
});

messagesRouter.get('/', validateQuery(listSchema), async (req, res) => {
  const { organizationId } = auth(req);
  const { status, limit, before } = parsedQuery<z.infer<typeof listSchema>>(req);

  const filter: Record<string, unknown> = { organizationId };
  if (status) filter.status = status;
  if (before && Types.ObjectId.isValid(before)) filter._id = { $lt: new Types.ObjectId(before) };

  const docs = await MessageModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);
  res.json({
    items: items.map((m) => ({
      id: m._id,
      messageId: m.messageId,
      from: m.from,
      to: m.to.map((r) => ({ address: r.address, status: r.status })),
      subject: m.subject,
      status: m.status,
      attempts: m.attempts,
      sizeBytes: m.sizeBytes,
      createdAt: m.createdAt,
      completedAt: m.completedAt,
    })),
    nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
  });
});

messagesRouter.get('/:id', async (req, res) => {
  const { organizationId } = auth(req);
  if (!Types.ObjectId.isValid(req.params.id ?? '')) throw ApiError.notFound('Message not found');
  const message = await MessageModel.findOne({ _id: req.params.id, organizationId }).lean();
  if (!message) throw ApiError.notFound('Message not found');
  const events = await MessageEventModel.find({ messageId: message._id }).sort({ at: 1 }).lean();
  res.json({
    id: message._id,
    messageId: message.messageId,
    from: message.from,
    envelopeFrom: message.envelopeFrom,
    to: message.to,
    subject: message.subject,
    status: message.status,
    attempts: message.attempts,
    sizeBytes: message.sizeBytes,
    lastError: message.lastError,
    createdAt: message.createdAt,
    completedAt: message.completedAt,
    events: events.map((e) => ({
      type: e.type,
      recipient: e.recipient,
      mxHost: e.mxHost,
      smtpCode: e.smtpCode,
      smtpResponse: e.smtpResponse,
      at: e.at,
    })),
  });
});
