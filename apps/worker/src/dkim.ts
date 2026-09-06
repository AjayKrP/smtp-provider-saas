import { dkimSign } from 'mailauth/lib/dkim/sign.js';
import { decryptString, logger, type DomainDoc } from '@smtp-saas/shared';

/**
 * Prepend a DKIM-Signature header to the raw MIME, signed with the sending domain's key.
 * Returns the original message unchanged if signing fails (better to send unsigned than
 * to drop the message — deliverability suffers but the caller is notified via logs).
 *
 * mailauth's `dkimSign` only signs entries passed in `signatureData`; the top-level
 * signing fields exist for typing compatibility.
 */
export async function dkimSignMessage(raw: Buffer, domain: DomainDoc): Promise<Buffer> {
  try {
    const privateKey = decryptString(domain.dkimPrivateKeyEnc);
    const signature = {
      signingDomain: domain.domain,
      selector: domain.dkimSelector,
      privateKey,
      algorithm: 'rsa-sha256',
    };
    const result = await dkimSign(raw, {
      ...signature,
      canonicalization: 'relaxed/relaxed',
      signTime: new Date(),
      signatureData: [signature],
    });

    const errors = result.errors ?? [];
    if (errors.length) logger.warn({ errors, domain: domain.domain }, 'dkim signing warnings');

    const signatures = (result.signatures ?? '').trim();
    if (!signatures) return raw;
    return Buffer.concat([Buffer.from(signatures + '\r\n'), raw]);
  } catch (err) {
    logger.error({ err, domain: domain.domain }, 'dkim signing failed; sending unsigned');
    return raw;
  }
}
