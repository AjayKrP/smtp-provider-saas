import { Worker } from 'bullmq';
import {
  DELIVERY_QUEUE,
  connectMongo,
  createRedis,
  disconnectMongo,
  logger,
  type DeliveryJobData,
} from '@smtp-saas/shared';
import { env } from './env.js';
import { processDelivery } from './processor.js';

async function main(): Promise<void> {
  await connectMongo();
  const connection = createRedis();

  const worker = new Worker<DeliveryJobData>(DELIVERY_QUEUE, processDelivery, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: { max: env.WORKER_RATE_LIMIT_PER_SEC, duration: 1000 },
  });

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'delivery job completed'));
  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message }, 'delivery job failed'),
  );
  worker.on('error', (err) => logger.error({ err }, 'worker error'));

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'delivery worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down worker');
    await worker.close();
    connection.disconnect();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
