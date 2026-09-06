import { Redis, type RedisOptions } from 'ioredis';
import { loadSharedEnv } from './config.js';

/**
 * Create a new Redis connection. BullMQ requires `maxRetriesPerRequest: null`
 * on the connections it uses, so that is the default here.
 */
export function createRedis(overrides: RedisOptions = {}): Redis {
  const { REDIS_URL } = loadSharedEnv();
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null, ...overrides });
}

let shared: Redis | undefined;

/** Shared connection for lightweight use (rate limiting, locks). */
export function sharedRedis(): Redis {
  return (shared ??= createRedis());
}
