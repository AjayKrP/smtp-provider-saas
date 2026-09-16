import { sendMail } from './mailer.js';
import { renderEmail, type EmailTemplateName, type EmailTemplates } from './render.js';

/** Render a file-based email template (see render.ts) and send it. */
export async function sendTemplate<N extends EmailTemplateName>(
  to: string,
  name: N,
  data: EmailTemplates[N],
): Promise<void> {
  const { subject, html, text } = renderEmail(name, data);
  await sendMail({ to, subject, html, text });
}

/**
 * Transactional email must never sit in a request's critical path. A single
 * unreachable mail host used to make POST /auth/register take 30 seconds (nodemailer's
 * connect + greeting timeouts) before returning the same response it would have anyway,
 * because nothing in the handler depends on the result.
 *
 * Sends are tracked so tests can await them deterministically.
 */
const inFlight = new Set<Promise<unknown>>();

export function sendInBackground(work: Promise<unknown>): void {
  inFlight.add(work);
  void work.finally(() => inFlight.delete(work));
}

/** Test helper: settle every background send started so far. */
export const flushBackgroundMail = (): Promise<unknown> => Promise.allSettled([...inFlight]);
