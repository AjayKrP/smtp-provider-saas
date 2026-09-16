import { env } from '../env.js';

/** Split `MAIL_FROM` ("Brand <hello@example.com>") into its parts. */
export function mailSender(): { brand: string; supportEmail: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(env.MAIL_FROM);
  return match
    ? { brand: match[1]!.trim(), supportEmail: match[2]!.trim() }
    : { brand: env.MAIL_FROM, supportEmail: env.MAIL_FROM };
}
