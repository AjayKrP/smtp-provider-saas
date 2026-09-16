import { Link } from 'react-router-dom';
import { usePublicConfig } from '../api/hooks.js';
import { CopyButton } from '../components/bits.js';
import { DocPage, Mail, type DocSection } from '../components/DocPage.js';

function Code({ label, children }: { label: string; children: string }) {
  return (
    <div className="code">
      <div className="code-head">
        <span>{label}</span>
        <CopyButton value={children} label={`Copy ${label}`} />
      </div>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * One section per language so each can rank for its own long-tail query
 * ("django smtp settings", "send email from go") and be linked directly.
 */
function sectionsFor(host: string): DocSection[] {
  const env = `SMTP_HOST=${host}
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
MAIL_FROM="Your App <hello@yourdomain.com>"`;

  return [
    {
      id: 'quick-start',
      title: 'Quick start',
      body: (
        <>
          <p>
            We are a plain SMTP server, so there is no SDK to install and no vendor lock-in.
            Anything that can send email already works. You need four settings:
          </p>
          <table className="doc-table">
            <tbody>
              <tr>
                <td>Host</td>
                <td>
                  <code>{host}</code>
                </td>
              </tr>
              <tr>
                <td>Port</td>
                <td>
                  <code>587</code> with STARTTLS, or <code>465</code> with implicit TLS
                </td>
              </tr>
              <tr>
                <td>Username</td>
                <td>
                  from <Link to="/credentials">SMTP credentials</Link> in your dashboard
                </td>
              </tr>
              <tr>
                <td>Password</td>
                <td>shown once when you create the credential</td>
              </tr>
            </tbody>
          </table>
          <p>
            Put them in your environment rather than your source code, and never commit the
            password:
          </p>
          <Code label=".env">{env}</Code>
          <p>
            Two rules worth knowing before your first send. The <strong>From address must be on a
            domain you have verified</strong> in <Link to="/domains">Domains</Link> — that is what
            lets us DKIM-sign your mail. And create a{' '}
            <strong>separate credential per app or environment</strong>, so you can revoke one
            without touching the rest.
          </p>
        </>
      ),
    },
    {
      id: 'ai-prompt',
      title: 'Let your AI assistant wire it up',
      body: (
        <>
          <p>
            Paste this into Cursor, Claude Code, Lovable, Bolt or Replit and it will add email to
            your app using whatever library your stack already uses:
          </p>
          <Code label="prompt">{`Add transactional email to this app using SMTP.

Read these from environment variables (never hard-code them):
  SMTP_HOST=${host}
  SMTP_PORT=587        # STARTTLS (or 465 for implicit TLS)
  SMTP_USER=<username from the dashboard>
  SMTP_PASS=<password from the dashboard>
  MAIL_FROM=hello@<my verified domain>

Create one sendEmail(to, subject, html) helper using this stack's
standard SMTP library, then use it for sign-up confirmation and
password-reset emails. Log and surface errors instead of failing
silently.`}</Code>
        </>
      ),
    },
    {
      id: 'nodejs',
      title: 'Node.js',
      body: (
        <>
          <p>
            Install <code>nodemailer</code>, then reuse a single transporter — creating one per
            message opens a new connection every time.
          </p>
          <Code label="email.js">{`import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to: 'customer@example.com',
  subject: 'Welcome aboard!',
  html: '<p>Thanks for signing up.</p>',
});`}</Code>
        </>
      ),
    },
    {
      id: 'nextjs',
      title: 'Next.js',
      body: (
        <>
          <p>
            Send from a route handler or a server action, never from the browser. Add{' '}
            <code>export const runtime = &apos;nodejs&apos;</code>: the Edge runtime has no TCP
            sockets, so SMTP cannot work there.
          </p>
          <Code label="app/api/send/route.ts">{`import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
});

export async function POST(req: Request) {
  const { to, subject, html } = await req.json();
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
  return Response.json({ sent: true });
}`}</Code>
        </>
      ),
    },
    {
      id: 'python',
      title: 'Python',
      body: (
        <>
          <p>No dependencies needed — the standard library speaks SMTP.</p>
          <Code label="send_email.py">{`import os, smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = os.environ["MAIL_FROM"]
msg["To"] = "customer@example.com"
msg["Subject"] = "Welcome aboard!"
msg.set_content("Thanks for signing up.")

with smtplib.SMTP(os.environ["SMTP_HOST"], 587) as smtp:
    smtp.starttls()
    smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    smtp.send_message(msg)`}</Code>
        </>
      ),
    },
    {
      id: 'django',
      title: 'Django',
      body: (
        <>
          <p>
            Configure the SMTP backend and every <code>send_mail()</code> call, plus the built-in
            password-reset flow, goes through us.
          </p>
          <Code label="settings.py">{`import os

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "${host}"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ["SMTP_USER"]
EMAIL_HOST_PASSWORD = os.environ["SMTP_PASS"]
DEFAULT_FROM_EMAIL = "Your App <hello@yourdomain.com>"`}</Code>
        </>
      ),
    },
    {
      id: 'php-laravel',
      title: 'PHP and Laravel',
      body: (
        <>
          <p>Laravel needs no code change — only environment variables.</p>
          <Code label=".env">{`MAIL_MAILER=smtp
MAIL_HOST=${host}
MAIL_PORT=587
MAIL_USERNAME=your-username
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=hello@yourdomain.com
MAIL_FROM_NAME="Your App"`}</Code>
          <p>
            On plain PHP, use PHPMailer with <code>SMTPAuth = true</code>,{' '}
            <code>SMTPSecure = &apos;tls&apos;</code> and <code>Port = 587</code>.
          </p>
        </>
      ),
    },
    {
      id: 'rails',
      title: 'Ruby on Rails',
      body: (
        <Code label="config/environments/production.rb">{`config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address:              "${host}",
  port:                 587,
  user_name:            ENV["SMTP_USER"],
  password:             ENV["SMTP_PASS"],
  authentication:       :plain,
  enable_starttls_auto: true
}`}</Code>
      ),
    },
    {
      id: 'go',
      title: 'Go',
      body: (
        <Code label="main.go">{`package main

import (
	"net/smtp"
	"os"
)

func main() {
	host := os.Getenv("SMTP_HOST")
	auth := smtp.PlainAuth("", os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASS"), host)

	msg := []byte("From: hello@yourdomain.com\\r\\n" +
		"To: customer@example.com\\r\\n" +
		"Subject: Welcome aboard!\\r\\n\\r\\n" +
		"Thanks for signing up.\\r\\n")

	if err := smtp.SendMail(host+":587", auth, "hello@yourdomain.com",
		[]string{"customer@example.com"}, msg); err != nil {
		panic(err)
	}
}`}</Code>
      ),
    },
    {
      id: 'java-spring',
      title: 'Java and Spring Boot',
      body: (
        <Code label="application.properties">{`spring.mail.host=${host}
spring.mail.port=587
spring.mail.username=\${SMTP_USER}
spring.mail.password=\${SMTP_PASS}
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true`}</Code>
      ),
    },
    {
      id: 'dotnet',
      title: '.NET and C#',
      body: (
        <>
          <p>
            MailKit is the recommended client; <code>SmtpClient</code> in{' '}
            <code>System.Net.Mail</code> is obsolete.
          </p>
          <Code label="Program.cs">{`using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

var message = new MimeMessage();
message.From.Add(MailboxAddress.Parse("hello@yourdomain.com"));
message.To.Add(MailboxAddress.Parse("customer@example.com"));
message.Subject = "Welcome aboard!";
message.Body = new TextPart("html") { Text = "<p>Thanks for signing up.</p>" };

using var client = new SmtpClient();
await client.ConnectAsync("${host}", 587, SecureSocketOptions.StartTls);
await client.AuthenticateAsync(
    Environment.GetEnvironmentVariable("SMTP_USER"),
    Environment.GetEnvironmentVariable("SMTP_PASS"));
await client.SendAsync(message);
await client.DisconnectAsync(true);`}</Code>
        </>
      ),
    },
    {
      id: 'supabase',
      title: 'Supabase Auth',
      body: (
        <>
          <p>
            Supabase&apos;s built-in email is rate-limited and not meant for production. In{' '}
            <strong>Project Settings → Authentication → SMTP Settings</strong>, enable a custom
            SMTP provider and enter:
          </p>
          <Code label="Supabase SMTP settings">{`Host:            ${host}
Port:            587
Username:        your-username
Password:        your-password
Sender email:    hello@yourdomain.com
Sender name:     Your App`}</Code>
          <p>
            The sender email must be on a domain you have verified here, or Supabase&apos;s
            confirmation and magic-link emails will be rejected.
          </p>
        </>
      ),
    },
    {
      id: 'no-code',
      title: 'n8n, Zapier and other no-code tools',
      body: (
        <p>
          Any tool with a generic “SMTP” or “Send Email” action works. Choose SMTP (not Gmail),
          then enter host <code>{host}</code>, port <code>587</code>, TLS/STARTTLS enabled, and your
          username and password. In n8n this is the <strong>SMTP</strong> credential used by the{' '}
          <strong>Send Email</strong> node.
        </p>
      ),
    },
    {
      id: 'troubleshooting',
      title: 'Common errors',
      body: (
        <>
          <p>Our server replies with a standard SMTP code and a plain-English reason.</p>
          <table className="doc-table errors">
            <thead>
              <tr>
                <th>Reply</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>535</code> Invalid username or password
                </td>
                <td>
                  Wrong credential, or it was revoked. Create a new one in{' '}
                  <Link to="/credentials">SMTP credentials</Link>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>550</code> …is not a verified sending domain
                </td>
                <td>
                  Your From address uses a domain that is not verified on this account. Add and
                  verify it in <Link to="/domains">Domains</Link>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>550</code> Exactly one From header is allowed
                </td>
                <td>
                  The message has several From headers or several addresses in one. Send one
                  sender address.
                </td>
              </tr>
              <tr>
                <td>
                  <code>452</code> Monthly send quota reached
                </td>
                <td>
                  You have used this month&apos;s allowance. It resets on the 1st, or you can{' '}
                  <Link to="/pricing">move to a bigger plan</Link>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>451</code> Sending rate limit reached
                </td>
                <td>Too many messages per minute. Retry shortly — this one is temporary.</td>
              </tr>
              <tr>
                <td>
                  <code>421</code> Too many failed login attempts
                </td>
                <td>
                  Repeated bad passwords from one IP. Wait 15 minutes and fix the credentials.
                </td>
              </tr>
              <tr>
                <td>
                  <code>552</code> Message exceeds maximum size
                </td>
                <td>Your plan&apos;s per-message limit, attachments included.</td>
              </tr>
            </tbody>
          </table>
          <p>
            Every accepted message, and what the recipient&apos;s server said about it, is listed
            in <Link to="/activity">Activity</Link>.
          </p>
        </>
      ),
    },
  ];
}

export function Docs() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  return (
    <DocPage
      eyebrow="Documentation"
      title="Integration guide"
      subtitle="Send your first email in a few minutes, from any language or framework."
      intro={
        <p>
          There is no API to learn: point your app&apos;s existing SMTP settings at{' '}
          <code>{host}</code>. Below are copy-paste examples for the stacks people use most.
        </p>
      }
      sections={sectionsFor(host)}
      footer={
        <>
          Stuck, or using something not listed here? Email <Mail /> and we&apos;ll help.
        </>
      }
    />
  );
}
