import {
  MessageEventModel,
  MessageModel,
  logger,
  rawMessageBucket,
  type MessageStatus,
} from '@smtp-saas/shared';

/**
 * Data retention, as promised in the privacy policy:
 *  - full message content (the raw MIME in GridFS) is deleted 7 days after acceptance;
 *  - message records and their delivery events (what Activity shows) after 30 days.
 * Suppressions, usage counters and payments are kept separately.
 *
 * Delivery retries give up within about 17 hours (10 attempts, exponential backoff from
 * 60s), so by day 7 every message has finished; anything still unfinished is marked
 * failed before its content goes.
 */
export const RETENTION = { contentDays: 7, recordDays: 30 } as const;

const DAY_MS = 24 * 60 * 60_000;
const BATCH = 500;
const TERMINAL: MessageStatus[] = ['delivered', 'bounced', 'failed'];

async function deleteRaw(fileId: unknown): Promise<void> {
  try {
    await rawMessageBucket().delete(
      fileId as Parameters<ReturnType<typeof rawMessageBucket>['delete']>[0],
    );
  } catch (err) {
    // Already gone (e.g. two worker slots overlapping during a deploy) is fine.
    if (!/FileNotFound|File not found/i.test(String((err as Error).message))) throw err;
  }
}

export async function runRetention(
  now = new Date(),
): Promise<{ contentDeleted: number; recordsDeleted: number }> {
  const contentCutoff = new Date(now.getTime() - RETENTION.contentDays * DAY_MS);
  const recordCutoff = new Date(now.getTime() - RETENTION.recordDays * DAY_MS);
  let contentDeleted = 0;
  let recordsDeleted = 0;

  for (;;) {
    const batch = await MessageModel.find(
      { createdAt: { $lt: contentCutoff }, rawDeletedAt: null },
      { rawRef: 1, status: 1 },
    )
      .limit(BATCH)
      .lean();
    if (batch.length === 0) break;
    for (const m of batch) {
      await deleteRaw(m.rawRef);
      const unfinished = !TERMINAL.includes(m.status as MessageStatus);
      await MessageModel.updateOne(
        { _id: m._id },
        {
          $set: {
            rawDeletedAt: now,
            ...(unfinished
              ? {
                  status: 'failed',
                  completedAt: now,
                  lastError: `not delivered within ${RETENTION.contentDays} days; content deleted`,
                }
              : {}),
          },
        },
      );
      contentDeleted += 1;
    }
  }

  for (;;) {
    const batch = await MessageModel.find(
      { createdAt: { $lt: recordCutoff } },
      { rawRef: 1, rawDeletedAt: 1 },
    )
      .limit(BATCH)
      .lean();
    if (batch.length === 0) break;
    const ids = batch.map((m) => m._id);
    for (const m of batch) if (!m.rawDeletedAt) await deleteRaw(m.rawRef);
    await MessageEventModel.deleteMany({ messageId: { $in: ids } });
    await MessageModel.deleteMany({ _id: { $in: ids } });
    recordsDeleted += ids.length;
  }

  if (contentDeleted || recordsDeleted) {
    logger.info({ contentDeleted, recordsDeleted }, 'retention job removed expired message data');
  }
  return { contentDeleted, recordsDeleted };
}
