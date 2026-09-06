import { connectMongo, disconnectMongo, logger } from '@smtp-saas/shared';
import { env } from './env.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  await connectMongo();
  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, 'api listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down api');
    server.close(() => {
      void disconnectMongo().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'api failed to start');
  process.exit(1);
});
