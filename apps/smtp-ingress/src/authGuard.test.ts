import { describe, expect, it } from 'vitest';
import {
  TooManyAuthFailures,
  createAuthGuard,
  isAttributableIp,
  type FailureStore,
} from './authGuard.js';

function memoryStore(): FailureStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    count: async (key) => counts.get(key) ?? 0,
    increment: async (key) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
  };
}

describe('createAuthGuard', () => {
  it('locks an IP out after too many failures without running the verifier again', async () => {
    const store = memoryStore();
    const guard = createAuthGuard({ store, maxFailures: 3, windowSec: 900, maxConcurrent: 4 });
    let verifications = 0;
    const wrongPassword = async () => {
      verifications += 1;
      return null;
    };

    for (let i = 0; i < 3; i += 1)
      expect(await guard.attempt('203.0.113.5', wrongPassword)).toBeNull();
    await expect(guard.attempt('203.0.113.5', wrongPassword)).rejects.toBeInstanceOf(
      TooManyAuthFailures,
    );
    expect(verifications).toBe(3);

    // Other IPs, and successful logins, are unaffected.
    expect(await guard.attempt('198.51.100.7', async () => 'user')).toBe('user');
    expect(store.counts.get('smtp-authfail:198.51.100.7')).toBeUndefined();
  });

  it('never runs more verifications at once than allowed', async () => {
    const guard = createAuthGuard({
      store: memoryStore(),
      maxFailures: 100,
      windowSec: 900,
      maxConcurrent: 2,
    });
    let peak = 0;
    const slow = async () => {
      peak = Math.max(peak, guard.running);
      await new Promise((r) => setTimeout(r, 20));
      return 'ok';
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => guard.attempt('192.0.2.1', slow)),
    );
    expect(results).toEqual(Array(10).fill('ok'));
    expect(peak).toBe(2);
    expect(guard.running).toBe(0);
  });

  it('fails open when the failure store is unavailable', async () => {
    const broken: FailureStore = {
      count: async () => {
        throw new Error('redis down');
      },
      increment: async () => {
        throw new Error('redis down');
      },
    };
    const guard = createAuthGuard({
      store: broken,
      maxFailures: 1,
      windowSec: 900,
      maxConcurrent: 1,
    });
    expect(await guard.attempt('192.0.2.9', async () => null)).toBeNull();
    expect(await guard.attempt('192.0.2.9', async () => 'user')).toBe('user');
  });

  it('does not lock out unattributable (shared gateway) addresses', async () => {
    const store = memoryStore();
    const guard = createAuthGuard({ store, maxFailures: 1, windowSec: 900, maxConcurrent: 1 });
    for (let i = 0; i < 5; i += 1) expect(await guard.attempt(null, async () => null)).toBeNull();
    expect(store.counts.size).toBe(0);
  });
});

describe('isAttributableIp', () => {
  it('treats public addresses as attributable and private/gateway ones as not', () => {
    for (const ip of ['203.0.113.5', '::ffff:198.51.100.7', '2a01:4f9:c013:48f6::2']) {
      expect(isAttributableIp(ip)).toBe(true);
    }
    for (const ip of [
      '172.18.0.1',
      '::ffff:172.18.0.1',
      '10.0.0.3',
      '127.0.0.1',
      '::1',
      'fd00::1',
      'fe80::1',
      '192.168.1.2',
      undefined,
    ]) {
      expect(isAttributableIp(ip)).toBe(false);
    }
  });
});
