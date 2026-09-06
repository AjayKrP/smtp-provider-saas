import { logger, sharedRedis } from '@smtp-saas/shared';

/**
 * Fixed-window rate limit. Returns true if the action is allowed.
 * Fails open on a Redis error — a rate-limiter outage should not stop mail.
 */
export async function allowRate(key: string, limit: number, windowSec = 60): Promise<boolean> {
  try {
    const redis = sharedRedis();
    const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;
    const count = await redis.incr(bucket);
    if (count === 1) await redis.expire(bucket, windowSec);
    return count <= limit;
  } catch (err) {
    logger.warn({ err, key }, 'rate limiter unavailable; allowing');
    return true;
  }
}
