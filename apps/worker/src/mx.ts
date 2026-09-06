import { Resolver } from 'node:dns/promises';
import { env, mxOverride } from './env.js';

export interface MxTarget {
  host: string;
  port: number;
}

const resolver = new Resolver();

/**
 * Ordered list of MX targets for a recipient domain. Honours DELIVERY_MX_OVERRIDE
 * (local testing), sorts real MX by preference, and falls back to the domain's
 * A/AAAA record per RFC 5321 §5.1 when no MX exists.
 */
export async function resolveMxTargets(domain: string): Promise<MxTarget[]> {
  if (mxOverride.length > 0) return mxOverride;

  try {
    const mx = await resolver.resolveMx(domain);
    if (mx.length > 0) {
      return mx
        .sort((a, b) => a.priority - b.priority)
        .map((r) => ({ host: r.exchange, port: 25 }));
    }
  } catch {
    // fall through to A-record fallback
  }

  try {
    await resolver.resolve4(domain);
    return [{ host: domain, port: 25 }];
  } catch {
    return [];
  }
}

export const heloName = env.SMTP_HOSTNAME;
