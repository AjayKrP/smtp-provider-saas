import nodemailer from 'nodemailer';
import { domainOf, logger } from '@smtp-saas/shared';
import { env } from './env.js';
import { heloName, resolveMxTargets } from './mx.js';

/**
 * Best-effort delivery status notification to the original envelope sender.
 * Failures here are logged and swallowed — a bounce for a bounce is pointless.
 */
export async function sendBounce(opts: {
  to: string;
  originalRecipient: string;
  reason: string;
  messageId: string;
}): Promise<void> {
  const toDomain = domainOf(opts.to);
  if (!toDomain) return;

  try {
    const targets = await resolveMxTargets(toDomain);
    if (!targets[0]) return;
    const transport = nodemailer.createTransport({
      host: targets[0].host,
      port: targets[0].port,
      secure: false,
      name: heloName,
      connectionTimeout: 20_000,
      tls: { rejectUnauthorized: false },
    });
    await transport.sendMail({
      envelope: { from: '', to: [opts.to] }, // null return-path, per RFC 3464
      from: `Mail Delivery System <postmaster@${env.BOUNCE_DOMAIN}>`,
      to: opts.to,
      subject: 'Delivery Status Notification (Failure)',
      text:
        `Your message could not be delivered to ${opts.originalRecipient}.\n\n` +
        `Reason: ${opts.reason}\n\n` +
        `Original-Message-ID: ${opts.messageId}\n`,
    });
    transport.close();
  } catch (err) {
    logger.warn({ err, to: opts.to }, 'failed to send bounce DSN');
  }
}
