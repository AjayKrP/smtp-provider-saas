import { Queue } from 'bullmq';
import { DELIVERY_QUEUE, createRedis, type DeliveryJobData } from '@smtp-saas/shared';

const connection = createRedis();

/**
 * Producer side of the delivery queue. The worker retries a job (with exponential
 * backoff) whenever any recipient is left in a deferred state; recipients already
 * delivered are skipped on the retry, so re-running a job is safe.
 */
export const deliveryQueue = new Queue<DeliveryJobData>(DELIVERY_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueDelivery(data: DeliveryJobData): Promise<void> {
  await deliveryQueue.add('deliver', data, { jobId: data.messageId });
}

export async function closeQueue(): Promise<void> {
  await deliveryQueue.close();
  connection.disconnect();
}
