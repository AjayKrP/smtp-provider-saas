import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../api/hooks.js';
import { CodeBlock } from '../../components/CodeBlock.js';
import { DocPage, type DocSection } from '../../components/DocPage.js';
import { RelatedGuides } from './GuidesIndex.js';

/**
 * The three "how do I send email from X" guides.
 *
 * They share a spine — the same credential table, the same verification step, the same
 * closing troubleshooter — and differ in the part that matters: where the send has to run
 * in that tool, and what stops it from running anywhere else. The shared sections live
 * here as builders rather than as one rigid template, so a page can drop or reorder them.
 */

function credentialsSection(host: string): DocSection {
  return {
    id: 'credentials',
    title: 'The four settings',
    body: (
      <>
        <p>
          Wherever the send ends up running, it needs the same four values. Create them under{' '}
          <Link to="/credentials">SMTP credentials</Link> — one per app, so you can revoke one
          without breaking the others.
        </p>
        <CodeBlock label=".env" lang="ini">{`SMTP_HOST=${host}
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
MAIL_FROM="Your App <hello@yourdomain.com>"`}</CodeBlock>
        <p>
          <code>MAIL_FROM</code> has to be on a domain you have verified in{' '}
          <Link to="/domains">Domains</Link>. That is what lets us DKIM-sign the message; send from
          an unverified domain and the message is rejected rather than delivered unsigned.
        </p>
      </>
    ),
  };
}

const SECRETS_WARNING = (
  <p>
    Never put these in client-side code or in a variable your framework exposes to the browser. An
    SMTP password in a frontend bundle is readable by anyone who opens devtools, and a leaked
    credential gets used to send spam within hours — which costs you the credential and your
    domain&apos;s reputation with it.
  </p>
);

function verifySection(): DocSection {
  return {
    id: 'verify',
    title: 'Check that it actually sent',
    body: (
      <>
        <p>
          Send one message to yourself, then open <Link to="/activity">Activity</Link>. Every
          message we accept is listed there with the receiving server&apos;s own reply, so you can
          tell the difference between three very different failures: the code never ran, we rejected
          it, or the recipient&apos;s server did.
        </p>
        <p>
          If it was accepted and delivered but landed in spam, that is a separate problem with a
          separate fix — see <Link to="/guides/why-emails-go-to-spam">why emails go to spam</Link>.
        </p>
      </>
    ),
  };
}

interface ErrorRow {
  id: string;
  symptom: ReactNode;
  meaning: ReactNode;
}

function errorsSection(rows: ErrorRow[]): DocSection {
  return {
    id: 'errors',
    title: 'Common failures',
    body: (
      <table className="doc-table errors">
        <thead>
          <tr>
            <th>What you see</th>
            <th>What it means</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.symptom}</td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  };
}

/* ------------------------------------------------------------------ Lovable */

export function LovableEmail() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  const sections: DocSection[] = [
    {
      id: 'which-emails',
      title: 'First, decide which emails you mean',
      body: (
        <>
          <p>
            Lovable apps use Supabase for auth, and the two kinds of email are set up in completely
            different places:
          </p>
          <ul>
            <li>
              <strong>Signup confirmation, magic links, password resets.</strong> These come from
              Supabase, not from your code. You do not write anything — you paste SMTP settings into
              the Supabase dashboard. That is the{' '}
              <Link to="/guides/supabase-smtp-settings">Supabase Auth guide</Link>, and for most
              apps it is the only step needed.
            </li>
            <li>
              <strong>Your own emails</strong> — welcome messages, order receipts, notifications.
              These need a few lines of code, in an edge function. That is the rest of this page.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'why-edge-function',
      title: 'Why it cannot live in the app itself',
      body: (
        <>
          <p>
            Lovable writes a React frontend that runs in your visitor&apos;s browser. A browser
            cannot open an SMTP connection — it has no raw TCP sockets, only HTTP — and even if it
            could, the password would be sitting in the JavaScript bundle for anyone to read.
          </p>
          <p>
            So the send runs in a <strong>Supabase edge function</strong>: server-side code that
            ships with your project, holds the secrets, and is the one place allowed to talk to a
            mail server. If you ask Lovable for email without saying this, it will sometimes write
            browser code that silently never sends.
          </p>
        </>
      ),
    },
    credentialsSection(host),
    {
      id: 'edge-function',
      title: 'The edge function',
      body: (
        <>
          <p>
            Edge functions run on Deno, so Nodemailer is not available — use <code>denomailer</code>
            , which speaks the same protocol. Create{' '}
            <code>supabase/functions/send-email/index.ts</code>:
          </p>
          <CodeBlock
            label="supabase/functions/send-email/index.ts"
            lang="typescript"
          >{`import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

Deno.serve(async (req) => {
  const { to, subject, html } = await req.json();

  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST')!,
      port: 587,
      // false on 587: the connection starts in the clear and is upgraded
      // with STARTTLS. Use true only on port 465.
      tls: false,
      auth: {
        username: Deno.env.get('SMTP_USER')!,
        password: Deno.env.get('SMTP_PASS')!,
      },
    },
  });

  try {
    await client.send({
      from: Deno.env.get('MAIL_FROM')!,
      to,
      subject,
      html,
    });
  } finally {
    await client.close();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});`}</CodeBlock>
          <p>Set the secrets once, from your machine or the Supabase dashboard:</p>
          <CodeBlock label="terminal" lang="bash">{`supabase secrets set \\
  SMTP_HOST=${host} \\
  SMTP_USER=your-username \\
  SMTP_PASS=your-password \\
  MAIL_FROM="Your App <hello@yourdomain.com>"

supabase functions deploy send-email`}</CodeBlock>
          {SECRETS_WARNING}
        </>
      ),
    },
    {
      id: 'call-it',
      title: 'Calling it from the app',
      body: (
        <>
          <CodeBlock
            label="src/lib/email.ts"
            lang="typescript"
          >{`const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'customer@example.com',
    subject: 'Welcome aboard',
    html: '<p>Thanks for signing up.</p>',
  },
});

if (error) throw error;`}</CodeBlock>
          <p>
            Leave the function&apos;s JWT verification on, which is the default. A function that
            sends arbitrary email to arbitrary addresses without checking who is calling is an open
            relay: within days it will be found and used to send spam in your name. Decide the
            recipient and the content from the signed-in user on the server side wherever you can,
            rather than trusting whatever the browser posted.
          </p>
        </>
      ),
    },
    {
      id: 'prompt',
      title: 'The prompt to give Lovable',
      body: (
        <>
          <p>
            Pasting this is usually faster than describing it, and it names the constraints Lovable
            otherwise has to guess:
          </p>
          <CodeBlock label="prompt" lang="plaintext">{`Add transactional email to this app.

Send it from a Supabase edge function called send-email, using the
denomailer library (this runs on Deno, so Nodemailer will not work).
Read SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM from the function's
environment — never from client code, and never hard-coded.

Use port 587 with tls: false so STARTTLS is negotiated.
Keep JWT verification enabled and derive the recipient from the
signed-in user rather than from the request body.

Then call it with supabase.functions.invoke('send-email') when a user
signs up, and surface any error instead of failing silently.`}</CodeBlock>
        </>
      ),
    },
    verifySection(),
    errorsSection([
      {
        id: 'silent',
        symptom: 'Nothing happens, no error in the browser',
        meaning: (
          <>
            The send is probably still in client code, where it cannot work. Check that it runs in
            an edge function.
          </>
        ),
      },
      {
        id: 'nodemailer',
        symptom: 'Cannot find module "nodemailer"',
        meaning: <>Edge functions run Deno. Use denomailer, as above.</>,
      },
      {
        id: '535',
        symptom: (
          <>
            <code>535</code> authentication failed
          </>
        ),
        meaning: <>Secrets not set, or set on the wrong project. Re-run the secrets command.</>,
      },
      {
        id: '550',
        symptom: (
          <>
            <code>550</code> not a verified sending domain
          </>
        ),
        meaning: (
          <>
            <code>MAIL_FROM</code> is on a domain that is not verified in{' '}
            <Link to="/domains">Domains</Link>.
          </>
        ),
      },
    ]),
  ];

  return (
    <DocPage
      eyebrow="Guide · 8 min"
      title="Send email from a Lovable app"
      subtitle="Auth emails come from Supabase; your own emails come from an edge function. Here is both, with the settings to paste."
      intro={
        <p>
          The short version: signup and password-reset email needs no code at all, just SMTP
          settings in Supabase. Everything else runs in a Supabase edge function, because a browser
          cannot speak SMTP and should never hold your password.
        </p>
      }
      sections={sections}
      footer={<RelatedGuides path="/guides/send-email-from-lovable" />}
    />
  );
}

/* --------------------------------------------------------------------- Bolt */

export function BoltEmail() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  const sections: DocSection[] = [
    {
      id: 'preview',
      title: 'Why it never works in the preview',
      body: (
        <>
          <p>
            Bolt runs your app in a WebContainer — a Node runtime compiled to WebAssembly, running
            inside the browser tab. It is a genuinely impressive trick, and it has one hard limit
            that matters here: <strong>it cannot open raw TCP connections</strong>. The browser only
            grants HTTP and WebSockets.
          </p>
          <p>
            SMTP is raw TCP. So mail code in the Bolt preview does not fail because of your settings
            — it cannot connect at all, usually surfacing as a connection timeout or an unhelpful{' '}
            <code>ECONNREFUSED</code>. Every minute spent checking the host and password is wasted;
            the code has to run somewhere else.
          </p>
          <p>
            &ldquo;Somewhere else&rdquo; means deployed. Bolt deploys to Netlify in one click, so
            the shortest path is a Netlify function, which is ordinary Node and can open sockets
            like anything else.
          </p>
        </>
      ),
    },
    credentialsSection(host),
    {
      id: 'function',
      title: 'The serverless function',
      body: (
        <>
          <p>
            Create <code>netlify/functions/send-email.ts</code>. This is real Node, so Nodemailer
            works:
          </p>
          <CodeBlock
            label="netlify/functions/send-email.ts"
            lang="typescript"
          >{`import nodemailer from 'nodemailer';
import type { Handler } from '@netlify/functions';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { to, subject, html } = JSON.parse(event.body ?? '{}');

  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    // Log the real reason; return something the UI can show.
    console.error('send failed', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not send email' }) };
  }
};`}</CodeBlock>
          <p>
            Add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and{' '}
            <code>MAIL_FROM</code> under <strong>Site configuration → Environment variables</strong>{' '}
            in Netlify, then redeploy so the function picks them up.
          </p>
          {SECRETS_WARNING}
        </>
      ),
    },
    {
      id: 'call-it',
      title: 'Calling it from your app',
      body: (
        <>
          <CodeBlock
            label="src/lib/email.ts"
            lang="typescript"
          >{`export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) throw new Error('Could not send email');
}`}</CodeBlock>
          <p>
            That endpoint is public. Before you ship it, make it check something — a signed-in
            session, or at minimum that the recipient is an address your app chose rather than one
            the caller supplied. An unguarded send endpoint is an open relay, and it will be found.
          </p>
        </>
      ),
    },
    {
      id: 'prompt',
      title: 'The prompt to give Bolt',
      body: (
        <CodeBlock label="prompt" lang="plaintext">{`Add transactional email to this app.

Important: SMTP cannot run in the WebContainer preview, because it
needs a raw TCP socket. Put the send in a Netlify function at
netlify/functions/send-email.ts using Nodemailer, and call it from the
client with fetch('/.netlify/functions/send-email').

Read SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM from process.env
inside the function only — never in client code, never hard-coded.
Use port 587. Reuse a single transporter across invocations.

Reject requests that are not POST, and do not let the caller choose an
arbitrary recipient. Surface send failures in the UI instead of
swallowing them.`}</CodeBlock>
      ),
    },
    verifySection(),
    errorsSection([
      {
        id: 'preview-timeout',
        symptom: 'Timeout or ECONNREFUSED in the preview',
        meaning: (
          <>Expected — WebContainers cannot open TCP sockets. Deploy and test the deployed URL.</>
        ),
      },
      {
        id: 'function-404',
        symptom: '404 on /.netlify/functions/send-email',
        meaning: (
          <>
            The function was not deployed. Check it sits under <code>netlify/functions/</code> and
            that the build published it.
          </>
        ),
      },
      {
        id: 'env-missing',
        symptom: 'Works locally, fails once deployed',
        meaning: <>Environment variables set in one place only. Netlify needs its own copy.</>,
      },
      {
        id: 'cold-start',
        symptom: 'Function times out after 10 seconds',
        meaning: (
          <>
            A transporter created per request on a cold start. Create it once at module scope, as
            above.
          </>
        ),
      },
    ]),
  ];

  return (
    <DocPage
      eyebrow="Guide · 8 min"
      title="Send email from a Bolt.new app"
      subtitle="The preview cannot send mail no matter what you configure. Here is why, and where the code has to go instead."
      intro={
        <p>
          If you have been fighting a connection timeout in the Bolt preview, stop: nothing is wrong
          with your settings. WebContainers have no raw TCP, so SMTP only works once the app is
          deployed and the send moved into a serverless function.
        </p>
      }
      sections={sections}
      footer={<RelatedGuides path="/guides/send-email-from-bolt" />}
    />
  );
}

/* ------------------------------------------------------------------ Next.js */

export function NextjsEmail() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  const sections: DocSection[] = [
    credentialsSection(host),
    {
      id: 'runtime',
      title: 'The one line everybody misses',
      body: (
        <>
          <p>
            Next.js can run your server code on two different runtimes. The edge runtime is a
            trimmed-down environment without Node&apos;s <code>net</code> module — so it cannot open
            a TCP socket, and SMTP cannot work there. Nodemailer will either fail to bundle or fail
            at runtime with a module-not-found error for something you never imported.
          </p>
          <CodeBlock
            label="app/api/send/route.ts"
            lang="typescript"
          >{`export const runtime = 'nodejs';`}</CodeBlock>
          <p>
            Put that in any route handler that sends mail. It is the default today, but it is also
            the first thing a deployment platform or a stray config file will change for you, and
            the resulting error never mentions SMTP. The same applies to middleware, which is always
            edge — never send email from middleware.
          </p>
        </>
      ),
    },
    {
      id: 'route-handler',
      title: 'A route handler that sends',
      body: (
        <>
          <CodeBlock
            label="app/api/send/route.ts"
            lang="typescript"
          >{`import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Module scope, so a warm lambda reuses the connection instead of
// opening a new one for every message.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function POST(request: Request) {
  const { to, subject, html } = await request.json();

  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('send failed', err);
    return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
  }
}`}</CodeBlock>
          <p>
            Two details worth keeping. The transporter is created once at module scope — a new one
            per request opens a fresh connection and authenticates again every time. And the real
            error is logged while the response stays vague: SMTP replies sometimes quote the
            recipient address back, which you do not want to hand to an anonymous caller.
          </p>
        </>
      ),
    },
    {
      id: 'server-action',
      title: 'Or a server action',
      body: (
        <>
          <p>
            If the send is the result of a form submission, a server action is tidier — there is no
            endpoint to guard, because the function is only reachable through the form:
          </p>
          <CodeBlock label="app/actions.ts" lang="typescript">{`'use server';

import { transporter } from '@/lib/mailer';

export async function subscribe(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  if (!email.includes('@')) return { error: 'Enter a valid email address' };

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Welcome aboard',
    html: '<p>Thanks for signing up.</p>',
  });

  return { ok: true };
}`}</CodeBlock>
        </>
      ),
    },
    {
      id: 'env',
      title: 'Environment variables',
      body: (
        <>
          <p>
            Keep the SMTP values server-only. In Next.js that means never prefixing them with{' '}
            <code>NEXT_PUBLIC_</code> — that prefix is what inlines a value into the browser bundle,
            and an SMTP password there is a credential given away.
          </p>
          <CodeBlock label=".env.local" lang="ini">{`SMTP_HOST=${host}
SMTP_USER=your-username
SMTP_PASS=your-password
MAIL_FROM="Your App <hello@yourdomain.com>"`}</CodeBlock>
          <p>
            Add the same four to your hosting provider&apos;s environment settings and redeploy —{' '}
            <code>.env.local</code> is local only, by design.
          </p>
        </>
      ),
    },
    verifySection(),
    errorsSection([
      {
        id: 'module-not-found',
        symptom: 'Module not found: net / dns / tls',
        meaning: (
          <>
            The code is being bundled for the edge runtime. Add{' '}
            <code>export const runtime = &apos;nodejs&apos;</code>.
          </>
        ),
      },
      {
        id: 'dev-only',
        symptom: 'Works in dev, fails in production',
        meaning: (
          <>Environment variables missing on the host, or a different runtime in production.</>
        ),
      },
      {
        id: 'timeout',
        symptom: 'Function timeout on a serverless host',
        meaning: (
          <>A transporter created per request, or a blocked port. Reuse one at module scope.</>
        ),
      },
      {
        id: 'double-send',
        symptom: 'Emails arrive twice in development',
        meaning: (
          <>
            React strict mode double-invokes effects. Send from the server, not from an effect in a
            client component.
          </>
        ),
      },
    ]),
  ];

  return (
    <DocPage
      eyebrow="Guide · 8 min"
      title="Send email from Next.js over SMTP"
      subtitle="A route handler, a server action, and the runtime setting that quietly breaks SMTP on the edge."
      intro={
        <p>
          Next.js needs no email SDK — Nodemailer over plain SMTP is enough. The one thing that
          catches everyone is the runtime: on the edge runtime there is no TCP, so no SMTP, and the
          error never says so.
        </p>
      }
      sections={sections}
      footer={<RelatedGuides path="/guides/send-email-from-nextjs" />}
    />
  );
}
