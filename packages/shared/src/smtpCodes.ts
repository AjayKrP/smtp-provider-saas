/** Classification of an SMTP reply from a downstream MX. */
export type SmtpOutcome = 'delivered' | 'deferred' | 'bounced';

/**
 * Map an SMTP response code to a delivery outcome.
 *  - 2xx           -> delivered
 *  - 4xx / no code -> deferred (transient; retry later)
 *  - 5xx           -> bounced (permanent)
 */
export function classifySmtpCode(code: number | undefined | null): SmtpOutcome {
  if (typeof code !== 'number' || Number.isNaN(code)) return 'deferred';
  if (code >= 200 && code < 300) return 'delivered';
  if (code >= 500) return 'bounced';
  return 'deferred';
}

/** nodemailer/SMTP errors carry `responseCode`; connection errors do not. */
export function outcomeFromError(err: unknown): { outcome: SmtpOutcome; code?: number; response?: string } {
  const e = err as { responseCode?: number; response?: string; message?: string };
  const code = typeof e.responseCode === 'number' ? e.responseCode : undefined;
  return { outcome: classifySmtpCode(code), code, response: e.response ?? e.message };
}
