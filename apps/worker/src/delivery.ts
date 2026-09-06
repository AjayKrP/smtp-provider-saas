import nodemailer from 'nodemailer';
import { outcomeFromError, type SmtpOutcome } from '@smtp-saas/shared';
import { heloName, resolveMxTargets } from './mx.js';

export interface RecipientResult {
  address: string;
  outcome: SmtpOutcome;
  code?: number;
  response?: string;
  mxHost?: string;
}

function fanOut(
  recipients: string[],
  result: Omit<RecipientResult, 'address'>,
): RecipientResult[] {
  return recipients.map((address) => ({ address, ...result }));
}

/** Attempt delivery of one signed message to all recipients that share a domain. */
export async function deliverToDomain(opts: {
  domain: string;
  recipients: string[];
  envelopeFrom: string;
  raw: Buffer;
}): Promise<RecipientResult[]> {
  const targets = await resolveMxTargets(opts.domain);
  if (targets.length === 0) {
    return fanOut(opts.recipients, { outcome: 'deferred', response: 'no MX or A records for domain' });
  }

  let lastError: unknown;
  for (const target of targets) {
    const transport = nodemailer.createTransport({
      host: target.host,
      port: target.port,
      secure: false,
      name: heloName,
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 120_000,
      // Opportunistic STARTTLS; remote MX certs are frequently self-signed.
      tls: { rejectUnauthorized: false },
    });

    try {
      const info = await transport.sendMail({
        envelope: { from: opts.envelopeFrom, to: opts.recipients },
        raw: opts.raw,
      });
      const rejected = new Set((info.rejected ?? []).map((r) => String(r).toLowerCase()));
      return opts.recipients.map((address) => ({
        address,
        outcome: rejected.has(address) ? ('bounced' as const) : ('delivered' as const),
        response: String(info.response ?? ''),
        mxHost: target.host,
      }));
    } catch (err) {
      lastError = err;
      const classified = outcomeFromError(err);
      if (classified.outcome === 'bounced') {
        return fanOut(opts.recipients, {
          outcome: 'bounced',
          code: classified.code,
          response: classified.response,
          mxHost: target.host,
        });
      }
      // transient failure — try the next MX host
    } finally {
      transport.close();
    }
  }

  const classified = outcomeFromError(lastError);
  return fanOut(opts.recipients, {
    outcome: classified.outcome === 'delivered' ? 'deferred' : classified.outcome,
    code: classified.code,
    response: classified.response,
  });
}
