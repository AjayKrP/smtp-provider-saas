import { Resolver } from 'node:dns/promises';
import { env, mxOverride } from './env.js';

export interface MxTarget {
  /** Hostname from the MX record. Used for TLS SNI and for the delivery log. */
  host: string;
  /** The address actually connected to — always IPv4. See resolveMxTargets. */
  address: string;
  port: number;
}

const resolver = new Resolver();

/**
 * How many connection attempts one domain gets. A domain with five MX hosts behind four
 * addresses each would otherwise be twenty attempts at a 30-second connect timeout, and
 * a queued message would sit there for ten minutes before deferring.
 */
const MAX_TARGETS = 5;

/**
 * Flatten resolved MX hosts into connection targets, in order, capped.
 *
 * Pure so the ordering rules can be tested without touching DNS: hosts stay in the order
 * given (already sorted by MX preference), each host contributes its addresses in the
 * order the resolver returned them, and hosts that resolved to nothing are skipped
 * rather than becoming a target that cannot be connected to.
 */
export function flattenTargets(
  hosts: { host: string; addresses: string[]; port: number }[],
  limit = MAX_TARGETS,
): MxTarget[] {
  const targets: MxTarget[] = [];
  for (const entry of hosts) {
    for (const address of entry.addresses) {
      if (targets.length >= limit) return targets;
      targets.push({ host: entry.host, address, port: entry.port });
    }
  }
  return targets;
}

/**
 * Ordered list of MX targets for a recipient domain. Honours DELIVERY_MX_OVERRIDE
 * (local testing), sorts real MX by preference, and falls back to the domain's
 * A record per RFC 5321 §5.1 when no MX exists.
 *
 * Deliberately IPv4 only. The sending host has a global IPv6 address, and Node's
 * Happy Eyeballs would otherwise connect over IPv6 whenever a recipient MX publishes an
 * AAAA record — on an address with no PTR record and no `ip6` mechanism in our SPF
 * record. Mail from it fails SPF outright and Gmail rejects IPv6 senders without valid
 * reverse DNS, so the v6 path is strictly worse than the v4 one until all three of those
 * are in place. Resolving A records ourselves is what makes that choice explicit:
 * handing nodemailer a hostname would leave the family selection up to Node.
 */
export async function resolveMxTargets(domain: string): Promise<MxTarget[]> {
  // Development points this at a local catcher, which is reached by address already.
  if (mxOverride.length > 0) {
    return mxOverride.map((o) => ({ host: o.host, address: o.host, port: o.port }));
  }

  try {
    const mx = await resolver.resolveMx(domain);
    if (mx.length > 0) {
      const ordered = mx.sort((a, b) => a.priority - b.priority);
      const resolved = await Promise.all(
        ordered.map(async (record) => ({
          host: record.exchange,
          port: 25,
          addresses: await resolver.resolve4(record.exchange).catch(() => []),
        })),
      );
      const targets = flattenTargets(resolved);
      if (targets.length > 0) return targets;
      // Every MX host is IPv6-only: deliverable in principle, not by us. Reported as a
      // deferral by the caller, which is honest — the message is not undeliverable.
    }
  } catch {
    // fall through to the A-record fallback
  }

  try {
    const addresses = await resolver.resolve4(domain);
    return flattenTargets([{ host: domain, addresses, port: 25 }]);
  } catch {
    return [];
  }
}

export const heloName = env.SMTP_HOSTNAME;
