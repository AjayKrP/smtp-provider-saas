import { sharedRedis } from '@smtp-saas/shared';
import type { FailureStore } from './authGuard.js';

const bucket = (key: string, windowSec: number) =>
  `rl:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;

/** Redis fixed-window counter; windows line up with ratelimit.ts. */
export function redisFailureStore(windowSec: number): FailureStore {
  return {
    async count(key) {
      return Number((await sharedRedis().get(bucket(key, windowSec))) ?? 0);
    },
    async increment(key) {
      const redis = sharedRedis();
      const k = bucket(key, windowSec);
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, windowSec);
    },
  };
}
