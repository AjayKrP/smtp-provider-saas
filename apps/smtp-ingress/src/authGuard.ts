/**
 * Protection for SMTP AUTH, where every attempt costs an argon2 verification
 * (~19 MB of memory for a moment):
 *  - an IP with too many recent failures is refused before any hashing happens;
 *  - at most `maxConcurrent` verifications run at once, so a flood of logins queues
 *    instead of exhausting memory.
 */

/** Fixed-window failure counter; the Redis-backed store lives in authGuardStore.ts. */
export interface FailureStore {
  count(key: string): Promise<number>;
  increment(key: string, windowSec: number): Promise<void>;
}

export interface AuthGuardOptions {
  store: FailureStore;
  maxFailures: number;
  windowSec: number;
  maxConcurrent: number;
}

export class TooManyAuthFailures extends Error {
  constructor() {
    super('Too many failed login attempts, try again later');
  }
}

export function createAuthGuard(opts: AuthGuardOptions) {
  let running = 0;
  const waiting: (() => void)[] = [];

  async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= opts.maxConcurrent) await new Promise<void>((resolve) => waiting.push(resolve));
    running += 1;
    try {
      return await fn();
    } finally {
      running -= 1;
      waiting.shift()?.();
    }
  }

  const key = (ip: string) => `smtp-authfail:${ip}`;

  return {
    /**
     * Run `verify` for a login attempt from `ip`. Resolves to its result, or rejects
     * with TooManyAuthFailures without calling it when the IP is locked out.
     */
    async attempt<T>(ip: string | null, verify: () => Promise<T | null>): Promise<T | null> {
      // `ip` is null when the client cannot be attributed (see isAttributableIp): it still
      // gets the concurrency cap, but no per-IP lockout that would hit innocent clients.
      if (ip) {
        // Fail open if the store is down: a limiter outage must not block every login.
        const failures = await opts.store.count(key(ip)).catch(() => 0);
        if (failures >= opts.maxFailures) throw new TooManyAuthFailures();
      }

      const result = await withSlot(verify);
      if (result === null && ip) {
        await opts.store.increment(key(ip), opts.windowSec).catch(() => undefined);
      }
      return result;
    },
    /** For tests and metrics. */
    get running() {
      return running;
    },
  };
}

/**
 * Whether a peer address identifies a real client. Traffic Docker proxies to the
 * container (IPv6 via docker-proxy, hairpin connections from the host's own services)
 * arrives from a private gateway address shared by everyone behind it.
 */
export function isAttributableIp(ip: string | undefined): ip is string {
  if (!ip) return false;
  const addr = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return !(
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(addr) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr) ||
    /^(::1$|f[cd][0-9a-f]{2}:|fe80:)/i.test(addr)
  );
}
