import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '@smtp-saas/shared';
import { env, isProd } from '../env.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SYSTEM_SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: env.SYSTEM_SMTP_HOST,
    port: env.SYSTEM_SMTP_PORT,
    // 465 is implicit TLS; anything else (587) upgrades with STARTTLS.
    secure: env.SYSTEM_SMTP_PORT === 465,
    requireTLS: env.SYSTEM_SMTP_PORT !== 465,
    auth: env.SYSTEM_SMTP_USER
      ? { user: env.SYSTEM_SMTP_USER, pass: env.SYSTEM_SMTP_PASS }
      : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
  return transport;
}

/** Send a transactional email. Without SYSTEM_SMTP_HOST it is logged instead. */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  const t = getTransport();
  if (!t) {
    const log = isProd ? logger.error.bind(logger) : logger.info.bind(logger);
    log(
      { to: mail.to, subject: mail.subject, text: mail.text },
      'SYSTEM_SMTP_HOST not set - transactional email NOT sent (logged instead)',
    );
    return;
  }
  await t.sendMail({ from: env.MAIL_FROM, ...mail });
}
