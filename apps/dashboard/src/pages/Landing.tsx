import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlans } from '../api/hooks.js';
import { CopyButton, Icon, money, type IconName } from '../components/bits.js';
import { PricingSection } from './Pricing.js';

const STACKS = [
  'Next.js',
  'Node.js',
  'Python',
  'Django',
  'Laravel',
  'Rails',
  'Supabase Auth',
  'n8n',
];

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'sparkles',
    title: 'Made for AI-built apps',
    body: 'Cursor, Claude, Lovable, Bolt or Replit already know SMTP. Paste our prompt and your assistant wires up sign-up, reset-password and receipt emails for you.',
  },
  {
    icon: 'code',
    title: 'Works with any stack',
    body: 'Plain SMTP on ports 587 and 465 — no SDK to install, no vendor lock-in. If your framework can send email, it works here.',
  },
  {
    icon: 'shield',
    title: 'Built to reach the inbox',
    body: 'Every email is DKIM-signed for your domain, with SPF alignment and TLS. We hand you the exact DNS records to paste.',
  },
  {
    icon: 'wallet',
    title: 'Priced for side projects',
    body: 'Start with 500 free emails a month, no card needed. Paid plans are prepaid with UPI or cards and never auto-renew.',
  },
  {
    icon: 'activity',
    title: 'See every email',
    body: 'Delivery logs show each message reaching the recipient’s server, plus bounces and retries — no more “did it send?”.',
  },
  {
    icon: 'key',
    title: 'No surprise bills',
    body: 'Hit your monthly limit and sending pauses with a retryable error. No overage charges, ever.',
  },
];

const STEPS = [
  {
    title: 'Sign up free',
    body: 'Create an account and add your domain. Copy the DNS records we generate into your DNS provider.',
  },
  {
    title: 'Get SMTP credentials',
    body: 'One click creates a username and password. Make a separate pair for each app.',
  },
  {
    title: 'Paste and ship',
    body: 'Drop the settings into your .env — or paste the prompt into your AI assistant — and send.',
  },
];

type Tab = 'prompt' | 'env' | 'node' | 'python';

function snippets(host: string): Record<Tab, { label: string; file: string; code: string }> {
  return {
    prompt: {
      label: 'AI prompt',
      file: 'paste into Cursor / Claude / Lovable',
      code: `Add transactional email to this app using SMTP.

Read these from environment variables (never hard-code them):
  SMTP_HOST=${host}
  SMTP_PORT=587        # STARTTLS (or 465 for implicit TLS)
  SMTP_USER=<username from the dashboard>
  SMTP_PASS=<password from the dashboard>
  MAIL_FROM=hello@<my verified domain>

Create one sendEmail(to, subject, html) helper using this stack's
standard SMTP library (Nodemailer for Node.js, smtplib for Python),
then use it for sign-up confirmation and password-reset emails.
Log and surface errors instead of failing silently.`,
    },
    env: {
      label: '.env',
      file: '.env',
      code: `SMTP_HOST=${host}
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
MAIL_FROM=hello@yourdomain.com`,
    },
    node: {
      label: 'Node.js',
      file: 'email.js',
      code: `import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

await transport.sendMail({
  from: process.env.MAIL_FROM,
  to: 'customer@example.com',
  subject: 'Welcome aboard!',
  html: '<p>Thanks for signing up.</p>',
});`,
    },
    python: {
      label: 'Python',
      file: 'email.py',
      code: `import os, smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = os.environ["MAIL_FROM"]
msg["To"] = "customer@example.com"
msg["Subject"] = "Welcome aboard!"
msg.set_content("Thanks for signing up.")

with smtplib.SMTP(os.environ["SMTP_HOST"], 587) as smtp:
    smtp.starttls()
    smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    smtp.send_message(msg)`,
    },
  };
}

function CodeShowcase({ host }: { host: string }) {
  const [tab, setTab] = useState<Tab>('prompt');
  const all = snippets(host);
  const current = all[tab];
  return (
    <div className="terminal showcase" id="prompt">
      <div className="bar">
        <i />
        <i />
        <i />
        <div className="tabs" role="tablist">
          {(Object.keys(all) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {all[key].label}
            </button>
          ))}
        </div>
        <CopyButton value={current.code} label={`Copy ${current.label}`} />
      </div>
      <div className="file">{current.file}</div>
      <pre>{current.code}</pre>
    </div>
  );
}

export function Landing() {
  const host = window.location.hostname;
  const { data: plans } = usePlans();
  // Quote the cheapest paid plan straight from the synced prices, never a literal.
  const cheapest = plans
    ?.filter((p) => p.price)
    .sort((a, b) => a.price!.unitAmount - b.price!.unitAmount)[0];

  return (
    <>
      <section className="section hero">
        <div className="pill">
          <span className="badge accent plain">New</span>
          Email for vibe-coded apps, set up in minutes
        </div>
        <h1>
          Your AI built the app. <span className="grad">We&apos;ll send its emails.</span>
        </h1>
        <p className="lede">
          Hassle-free, affordable email for apps built with Cursor, Claude, Lovable or Bolt.
          Sign-ups, password resets and receipts — four SMTP settings or one pasted prompt, and
          you&apos;re sending.
        </p>
        <div className="row cta">
          <Link to="/register" className="btn primary lg">
            Start free — no card <Icon name="arrow" />
          </Link>
          <a href="#prompt" className="btn lg">
            <Icon name="sparkles" /> Copy the AI prompt
          </a>
        </div>
        <p className="hero-note">
          500 emails/month free
          {cheapest?.price && (
            <>
              {' '}
              · paid plans from {money(cheapest.price.unitAmount, cheapest.price.currency)}/
              {cheapest.price.interval}
            </>
          )}{' '}
          · UPI &amp; cards · never auto-renews
        </p>

        <CodeShowcase host={host} />

        <div className="stacks">
          <span className="muted small">Works with</span>
          {STACKS.map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
          <span className="muted small">and anything else that speaks SMTP</span>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From zero to sending in three steps</h2>
          <p>No SDKs, no approval queues, no wrestling with DNS guides.</p>
        </div>
        <ol className="how">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="section-head">
          <span className="eyebrow">Why builders pick us</span>
          <h2>Everything your app needs to send email. Nothing it doesn&apos;t.</h2>
        </div>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="ico">
                <Icon name={f.icon} size={18} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <PricingSection id="pricing" />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <div>
            <h2>Ship the email feature tonight.</h2>
            <p>Your first 500 emails every month are free. Upgrade only when your app takes off.</p>
          </div>
          <Link to="/register" className="btn primary lg">
            Get your SMTP credentials <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </>
  );
}
