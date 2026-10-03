import { beforeAll, describe, expect, it } from 'vitest';

// mx.ts reads the worker env at module scope, so these must be set before it loads —
// hence the dynamic import below, as in retention.test.ts.
process.env.SMTP_HOSTNAME ??= 'mail.test.local';
process.env.BOUNCE_DOMAIN ??= 'bounces.test.local';

let flattenTargets: typeof import('./mx.js').flattenTargets;

beforeAll(async () => {
  ({ flattenTargets } = await import('./mx.js'));
});

describe('flattenTargets', () => {
  it('keeps MX preference order and expands each host to its addresses', () => {
    expect(
      flattenTargets([
        { host: 'mx1.example.com', addresses: ['10.0.0.1', '10.0.0.2'], port: 25 },
        { host: 'mx2.example.com', addresses: ['10.0.0.3'], port: 25 },
      ]),
    ).toEqual([
      { host: 'mx1.example.com', address: '10.0.0.1', port: 25 },
      { host: 'mx1.example.com', address: '10.0.0.2', port: 25 },
      { host: 'mx2.example.com', address: '10.0.0.3', port: 25 },
    ]);
  });

  it('skips a host that resolved to nothing instead of making it a target', () => {
    // An IPv6-only MX looks exactly like this: a hostname with no A records. Keeping it
    // would cost a 30-second connection timeout for a host we cannot reach.
    expect(
      flattenTargets([
        { host: 'ipv6only.example.com', addresses: [], port: 25 },
        { host: 'mx2.example.com', addresses: ['10.0.0.3'], port: 25 },
      ]),
    ).toEqual([{ host: 'mx2.example.com', address: '10.0.0.3', port: 25 }]);
  });

  it('caps the attempts so one message cannot occupy a worker for ten minutes', () => {
    const hosts = Array.from({ length: 5 }, (_, i) => ({
      host: `mx${i}.example.com`,
      addresses: ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'],
      port: 25,
    }));
    expect(flattenTargets(hosts)).toHaveLength(5);
    expect(flattenTargets(hosts, 2)).toEqual([
      { host: 'mx0.example.com', address: '10.0.0.1', port: 25 },
      { host: 'mx0.example.com', address: '10.0.0.2', port: 25 },
    ]);
  });

  it('returns nothing when no host resolved', () => {
    expect(flattenTargets([{ host: 'nowhere.example.com', addresses: [], port: 25 }])).toEqual([]);
  });

  it('preserves a non-default port, as a local override uses', () => {
    expect(flattenTargets([{ host: '127.0.0.1', addresses: ['127.0.0.1'], port: 1025 }])).toEqual([
      { host: '127.0.0.1', address: '127.0.0.1', port: 1025 },
    ]);
  });
});
