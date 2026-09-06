import { connectMongo, disconnectMongo, logger } from '@smtp-saas/shared';
import './env.js';
import { startSmtpServers } from './server.js';
import { closeQueue } from './queue.js';

async function main(): Promise<void> {
  await connectMongo();
  const servers = startSmtpServers();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down smtp-ingress');
    await servers.close();
    await closeQueue();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'smtp-ingress failed to start');
  process.exit(1);
});
