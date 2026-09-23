import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../api/hooks.js';
import { CodeBlock } from '../../components/CodeBlock.js';
import { DocPage, type DocSection } from '../../components/DocPage.js';
import { RelatedGuides } from '../guides/GuidesIndex.js';

/**
 * Comparison pages.
 *
 * Written to stay true without maintenance: they compare how each service is *shaped* —
 * protocol, billing model, what it does and does not include — and deliberately quote no
 * competitor prices or free-tier numbers, which change without notice and would make the
 * page wrong rather than merely out of date. Each one says plainly where the other
 * service is the better choice; a comparison that cannot do that is an advertisement.
 */

interface ComparisonSpec {
  path: string;
  rival: string;
  title: string;
  subtitle: string;
  intro: ReactNode;
  /** The specific reason a reader is on this page. */
  blocker: DocSection;
  /** Honest, and first-class: where the rival wins. */
  theirStrengths: ReactNode;
  /** How the code changes when moving across. */
  migration: (host: string) => ReactNode;
}

function rowsFor(rival: string): DocSection {
  return {
    id: 'differences',
    title: 'How the two are shaped',
    body: (
      <>
        <table className="doc-table">
          <thead>
            <tr>
              <th />
              <th>Email4VibeCoder</th>
              <th>{rival}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Billing currency</td>
              <td>INR</td>
              <td>USD</td>
            </tr>
            <tr>
              <td>Payment methods</td>
              <td>UPI, cards, netbanking, wallets (Razorpay)</td>
              <td>International card</td>
            </tr>
            <tr>
              <td>Renewal</td>
              <td>Prepaid one month at a time, never automatic</td>
              <td>Subscription, renews automatically</td>
            </tr>
            <tr>
              <td>Over your limit</td>
              <td>Temporary SMTP error, retry safely. No overage charge, ever.</td>
              <td>Overage billing or a hard stop, depending on plan</td>
            </tr>
            <tr>
              <td>How you send</td>
              <td>Plain SMTP, ports 587 and 465</td>
              <td>HTTP API, SDKs, and SMTP</td>
            </tr>
            <tr>
              <td>Lock-in</td>
              <td>None — it is four settings you can repoint anywhere</td>
              <td>Some, if you build on the API and templates</td>
            </tr>
            <tr>
              <td>Authentication</td>
              <td>DKIM signing, SPF alignment, TLS</td>
              <td>The same</td>
            </tr>
            <tr>
              <td>Delivery visibility</td>
              <td>Per-message log with the receiving server&apos;s own reply</td>
              <td>Dashboards, event webhooks, analytics</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted">
          Plan sizes and prices change on both sides — ours are on the{' '}
          <Link to="/pricing">pricing page</Link>, theirs on theirs. This table is about how each
          service works, which changes far less often.
        </p>
      </>
    ),
  };
}

function honestSection(rival: string, strengths: ReactNode): DocSection {
  return {
    id: 'when-not-us',
    title: `When ${rival} is the better choice`,
    body: (
      <>
        {strengths}
        <p>
          We would rather you know that now than discover it after moving. If any of the above is
          how you work, stay where you are.
        </p>
      </>
    ),
  };
}

function limitsSection(): DocSection {
  return {
    id: 'limits',
    title: 'What you give up here',
    body: (
      <ul>
        <li>
          <strong>No HTTP send API.</strong> SMTP only. Every framework speaks it, but if your
          platform blocks outbound SMTP ports entirely, an API-based provider is your only option.
        </li>
        <li>
          <strong>No template editor, no campaign tools, no open tracking.</strong> This is plumbing
          for application email, not a marketing platform.
        </li>
        <li>
          <strong>One sending region, and a young sending reputation.</strong> A large provider has
          years of history across thousands of IPs. We are building ours, carefully, which is why
          the acceptable-use rules here are strict.
        </li>
        <li>
          <strong>A small team.</strong> Support is email, and it is a person, not a rota.
        </li>
      </ul>
    ),
  };
}

function migrationSection(rival: string, body: ReactNode): DocSection {
  return {
    id: 'moving',
    title: `Moving an app across from ${rival}`,
    body: <>{body}</>,
  };
}

function ComparisonPage({ spec }: { spec: ComparisonSpec }) {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  const sections: DocSection[] = [
    spec.blocker,
    rowsFor(spec.rival),
    migrationSection(spec.rival, spec.migration(host)),
    honestSection(spec.rival, spec.theirStrengths),
    limitsSection(),
    {
      id: 'try',
      title: 'Trying it without committing',
      body: (
        <>
          <p>
            The free plan sends 500 emails a month on one domain and needs no card, so the honest
            way to evaluate this is to point a staging environment at it for a week and read the
            delivery log. Nothing auto-renews, and there is no subscription to cancel afterwards.
          </p>
          <p>
            <Link to="/register">Create a free account</Link>, or read the{' '}
            <Link to="/docs">integration guide</Link> first.
          </p>
        </>
      ),
    },
  ];

  return (
    <DocPage
      eyebrow="Comparison · 6 min"
      title={spec.title}
      subtitle={spec.subtitle}
      intro={spec.intro}
      sections={sections}
      footer={<RelatedGuides path={spec.path} />}
    />
  );
}

/* ---------------------------------------------------------------- SendGrid */

const SENDGRID: ComparisonSpec = {
  path: '/compare/sendgrid-alternative-india',
  rival: 'SendGrid',
  title: 'A SendGrid alternative for developers in India',
  subtitle:
    'Same SMTP, same DKIM, billed in rupees and paid by UPI. Here is the honest comparison, including where SendGrid still wins.',
  intro: (
    <p>
      Most people looking for this are not unhappy with SendGrid&apos;s delivery. They are stuck at
      the payment step, or on an account review that has gone quiet, and they need working email
      this week.
    </p>
  ),
  blocker: {
    id: 'the-blocker',
    title: 'The two things that send people looking',
    body: (
      <>
        <p>
          <strong>Payment.</strong> SendGrid bills in dollars and expects an international card.
          Plenty of Indian developers have a UPI id and a domestic card and no practical way to pay
          a recurring USD subscription — and the plan cost is often less of an issue than the fact
          that it cannot be paid at all.
        </p>
        <p>
          <strong>Account review.</strong> Sign-ups from some regions get held for compliance
          review, sometimes after the account already worked. When that happens mid-launch, there is
          no lever to pull.
        </p>
        <p>
          Neither is a criticism of the product — SendGrid is excellent infrastructure with real
          scale. They are reasons it may not be available to you, which is a different problem and
          the one this page is about.
        </p>
      </>
    ),
  },
  theirStrengths: (
    <ul>
      <li>
        <strong>Volume beyond what we serve.</strong> At millions of messages a month, with
        dedicated IPs and per-region infrastructure, SendGrid is a different class of service.
      </li>
      <li>
        <strong>Marketing email.</strong> Campaigns, template editors, contact management,
        subscriber tracking — all first-class there, and deliberately absent here.
      </li>
      <li>
        <strong>Event webhooks and analytics.</strong> If your product is built around open and
        click data streamed back to your app, that is their ground.
      </li>
      <li>
        <strong>Compliance paperwork.</strong> Enterprise procurement, SOC 2 reports, DPAs signed by
        a legal team.
      </li>
    </ul>
  ),
  migration: (host) => (
    <>
      <p>
        If you used SendGrid&apos;s SMTP relay, this is a four-line change and no code at all — the
        username is no longer the literal <code>apikey</code>, and the host and password change:
      </p>
      <CodeBlock label=".env" lang="ini">{`- SMTP_HOST=smtp.sendgrid.net
- SMTP_USER=apikey
- SMTP_PASS=SG.xxxxxxxx
+ SMTP_HOST=${host}
+ SMTP_USER=your-username
+ SMTP_PASS=your-password
  SMTP_PORT=587`}</CodeBlock>
      <p>
        If you used the Web API (<code>@sendgrid/mail</code>), swap it for Nodemailer or your
        language&apos;s standard SMTP library — see the <Link to="/docs">integration guide</Link>,
        which has a copy-paste example per stack. Then add your domain under{' '}
        <Link to="/domains">Domains</Link> and publish the DKIM record we generate; the SPF record
        you already have for SendGrid can keep its include alongside ours in the same record.
      </p>
      <p>
        Run both for a day if you can: point staging here, leave production where it is, and compare
        what actually arrives before you switch.
      </p>
    </>
  ),
};

/* ------------------------------------------------------------------ Resend */

const RESEND: ComparisonSpec = {
  path: '/compare/resend-alternative-india',
  rival: 'Resend',
  title: 'A Resend alternative that takes UPI',
  subtitle:
    'If the blocker is an international card rather than the product, here is what changes and what it costs you.',
  intro: (
    <p>
      Resend is a genuinely well-made product with the best developer experience in this category.
      This page exists for one reason: it bills in USD and expects an international card, and for a
      lot of Indian developers that is the end of the evaluation.
    </p>
  ),
  blocker: {
    id: 'the-blocker',
    title: 'The blocker is payment, not product',
    body: (
      <>
        <p>
          Worth saying plainly: if you can pay Resend, Resend is a great choice, and their React
          Email tooling has no equivalent here. We are not going to pretend otherwise.
        </p>
        <p>
          What we offer is the same job — authenticated transactional email from your own domain —
          payable with UPI, netbanking or a domestic card, prepaid one month at a time so nothing
          auto-renews against a card you would rather not keep on file.
        </p>
      </>
    ),
  },
  theirStrengths: (
    <ul>
      <li>
        <strong>React Email.</strong> Writing templates as React components, previewed locally, is a
        real advantage and it is theirs.
      </li>
      <li>
        <strong>A first-class HTTP API and SDKs.</strong> If you prefer an API call to an SMTP
        connection, or your host blocks SMTP ports, that settles it.
      </li>
      <li>
        <strong>Batch sending, scheduling, webhooks, audiences.</strong> Product surface we do not
        have and are not trying to build.
      </li>
      <li>
        <strong>Reputation at scale.</strong> More volume, more IPs, more history.
      </li>
    </ul>
  ),
  migration: (host) => (
    <>
      <p>
        Resend supports SMTP as well as its API, so if you were already using{' '}
        <code>smtp.resend.com</code> it is a settings change:
      </p>
      <CodeBlock label=".env" lang="ini">{`- SMTP_HOST=smtp.resend.com
- SMTP_USER=resend
- SMTP_PASS=re_xxxxxxxx
+ SMTP_HOST=${host}
+ SMTP_USER=your-username
+ SMTP_PASS=your-password
  SMTP_PORT=587`}</CodeBlock>
      <p>
        Coming from the SDK, the send becomes a Nodemailer call. React Email still works, by the way
        — render your template to an HTML string and pass it as the message body:
      </p>
      <CodeBlock label="email.ts" lang="typescript">{`import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import WelcomeEmail from './emails/welcome';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to: 'customer@example.com',
  subject: 'Welcome aboard',
  html: await render(<WelcomeEmail name="Ada" />),
});`}</CodeBlock>
      <p>
        Then verify your domain under <Link to="/domains">Domains</Link> and publish the DKIM
        record. Keep the Resend records in place until you have switched over — extra DKIM selectors
        do no harm, and they let you move back in a minute if you change your mind.
      </p>
    </>
  ),
};

export function SendgridAlternative() {
  return <ComparisonPage spec={SENDGRID} />;
}

export function ResendAlternative() {
  return <ComparisonPage spec={RESEND} />;
}
