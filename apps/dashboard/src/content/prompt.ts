/**
 * The paste-into-your-assistant prompts.
 *
 * One source, three consumers: the home page tab, the /prompt page people link to in an
 * answer, and the Markdown mirror the build writes for AI crawlers. Kept as plain strings
 * so the Node build can read them too.
 *
 * They are written the way a good issue is written — the constraints first, because an
 * assistant that does not know SMTP needs a server-side runtime will cheerfully write
 * browser code that silently never sends.
 */

export interface PromptVariant {
  id: string;
  label: string;
  /** Who it is for, shown above the block. */
  audience: string;
  text: (host: string) => string;
}

const SETTINGS = (host: string) => `  SMTP_HOST=${host}
  SMTP_PORT=587        # STARTTLS (or 465 for implicit TLS)
  SMTP_USER=<username from the dashboard>
  SMTP_PASS=<password from the dashboard>
  MAIL_FROM=hello@<my verified domain>`;

export const PROMPTS: PromptVariant[] = [
  {
    id: 'general',
    label: 'Any stack',
    audience: 'Cursor, Claude Code, Windsurf, Copilot — anywhere the assistant can see your repo.',
    text: (host) => `Add transactional email to this app using SMTP.

Read these from environment variables (never hard-code them):
${SETTINGS(host)}

Create one sendEmail(to, subject, html) helper using this stack's
standard SMTP library (Nodemailer for Node.js, smtplib for Python,
Swiftmailer/Symfony Mailer for PHP), then use it for sign-up
confirmation and password-reset emails.

Requirements:
- The send must run on the server, never in browser code.
- Reuse one transport/connection rather than creating one per message.
- Log the real error and surface a friendly one; never fail silently.
- Do not add a provider SDK — plain SMTP only.`,
  },
  {
    id: 'lovable',
    label: 'Lovable',
    audience: 'Lovable apps, which run a React frontend on top of Supabase.',
    text: (host) => `Add transactional email to this app.

Send it from a Supabase edge function called send-email, using the
denomailer library — edge functions run on Deno, so Nodemailer will
not work there.

Read these from the function's environment (never from client code):
${SETTINGS(host)}

Use port 587 with tls: false so STARTTLS is negotiated after connecting.
Keep JWT verification enabled on the function, and derive the recipient
from the signed-in user rather than trusting the request body.

Then call it with supabase.functions.invoke('send-email') after signup,
and show the user an error if it fails.

For signup confirmation and password-reset emails specifically: those
come from Supabase Auth, not from this function. Tell me to paste the
same SMTP settings into Supabase's Auth → SMTP settings instead.`,
  },
  {
    id: 'bolt',
    label: 'Bolt',
    audience: 'Bolt.new apps, which preview inside a WebContainer.',
    text: (host) => `Add transactional email to this app.

Important: SMTP needs a raw TCP socket, which the WebContainer preview
cannot open. The send must live in a deployed serverless function —
use a Netlify function at netlify/functions/send-email.ts with
Nodemailer, and call it from the client with fetch().

Read these from the function's environment only:
${SETTINGS(host)}

Create the transporter once at module scope so warm invocations reuse
it. Reject non-POST requests, and do not let the caller choose an
arbitrary recipient. Surface failures in the UI instead of swallowing
them, and tell me which environment variables to set in Netlify.`,
  },
];

export const promptFor = (id: string, host: string): string =>
  (PROMPTS.find((p) => p.id === id) ?? PROMPTS[0]!).text(host);
