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
