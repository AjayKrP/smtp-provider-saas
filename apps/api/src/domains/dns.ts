import { Resolver } from 'node:dns/promises';
import { dkimPublicKeyToDnsValue, type DomainDoc } from '@smtp-saas/shared';
import { env } from '../env.js';

export interface DnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
  purpose: string;
  required: boolean;
}

export function dkimTxtValue(publicKeyPem: string): string {
  return `v=DKIM1; k=rsa; p=${dkimPublicKeyToDnsValue(publicKeyPem)}`;
}

export function dnsRecordsFor(domain: DomainDoc): DnsRecord[] {
  const records: DnsRecord[] = [
    {
      type: 'TXT',
      host: `${domain.dkimSelector}._domainkey.${domain.domain}`,
      value: dkimTxtValue(domain.dkimPublicKey),
      purpose: 'DKIM signing key — lets recipients verify mail we send for you.',
      required: true,
    },
  ];
  if (env.MAIL_SPF_INCLUDE) {
    records.push({
      type: 'TXT',
      host: domain.domain,
      value: `v=spf1 include:${env.MAIL_SPF_INCLUDE} ~all`,
      purpose: 'SPF — authorizes our servers to send for your domain.',
      required: false,
    });
  }
  records.push({
    type: 'TXT',
    host: `_dmarc.${domain.domain}`,
    value: 'v=DMARC1; p=none; rua=mailto:dmarc@' + domain.domain,
    purpose: 'DMARC — start at p=none, tighten once mail is authenticating.',
    required: false,
  });
  return records;
}

/** Use public resolvers so results are not skewed by local/split-horizon DNS. */
function resolver(): Resolver {
  const r = new Resolver();
  r.setServers(['1.1.1.1', '8.8.8.8']);
  return r;
}

async function txtRecords(host: string): Promise<string[]> {
  try {
    const chunks = await resolver().resolveTxt(host);
    return chunks.map((parts) => parts.join(''));
  } catch {
    return [];
  }
}

export interface VerificationResult {
  dkimVerified: boolean;
  spfVerified: boolean;
  details: Record<string, string>;
}

export async function verifyDomainDns(domain: DomainDoc): Promise<VerificationResult> {
  const details: Record<string, string> = {};

  const expectedP = dkimPublicKeyToDnsValue(domain.dkimPublicKey);
  const dkimHost = `${domain.dkimSelector}._domainkey.${domain.domain}`;
  const dkimTxts = await txtRecords(dkimHost);
  const dkimVerified = dkimTxts.some((t) => t.replace(/\s+/g, '').includes(`p=${expectedP}`));
  details.dkim = dkimVerified
    ? 'found'
    : dkimTxts.length
      ? 'record present but key does not match'
      : `no TXT record at ${dkimHost}`;

  let spfVerified = false;
  if (env.MAIL_SPF_INCLUDE) {
    const spfTxts = await txtRecords(domain.domain);
    const spf = spfTxts.find((t) => t.toLowerCase().startsWith('v=spf1'));
    spfVerified = !!spf && spf.includes(env.MAIL_SPF_INCLUDE);
    details.spf = spfVerified ? 'found' : spf ? 'SPF record missing our include' : 'no SPF record';
  } else {
    details.spf = 'not required (operator has no SPF include configured)';
  }

  return { dkimVerified, spfVerified, details };
}
