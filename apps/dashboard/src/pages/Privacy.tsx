import { Link } from 'react-router-dom';
import { BRAND } from '../components/bits.js';
import { DocPage, Mail, type DocSection } from '../components/DocPage.js';
import { LEGAL_UPDATED } from './Terms.js';

const sections: DocSection[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <p>
        This policy explains how {BRAND}, operated from India, handles personal data when you use
        our website, dashboard and SMTP email-sending service (the “Service”). Contact us about
        privacy at <Mail />.
      </p>
    ),
  },
  {
    id: 'roles',
    title: 'Our two roles',
    body: (
      <ul>
        <li>
          <strong>Your account data</strong> (your name, email, billing records): we decide how it
          is used, as described here.
        </li>
        <li>
          <strong>The emails you send</strong> and your recipients’ addresses: we process these only
          on your instructions, to deliver your email. You are responsible for having a lawful basis
          — such as consent — to email your recipients, and for telling them how you use their data.
        </li>
      </ul>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address and organization name. Your
          password is stored only as a one-way hash, never in readable form.
        </li>
        <li>
          <strong>Sending setup</strong> — the domains you add and their DNS verification status;
          the DKIM signing key for each domain (stored encrypted); and your SMTP credentials
          (passwords stored only as hashes).
        </li>
        <li>
          <strong>Emails you send</strong> — sender, recipient addresses, subject, size, the full
          message content, delivery status, and responses from recipient mail servers. Addresses
          that hard-bounce are added to your account’s suppression list so we stop sending to them.
        </li>
        <li>
          <strong>Usage</strong> — monthly counts of emails accepted, delivered, bounced and failed.
        </li>
        <li>
          <strong>Billing</strong> — your plan, amounts, currency, dates, and Razorpay order and
          payment IDs. Payments are handled by Razorpay; we never receive your card, UPI or bank
          details.
        </li>
        <li>
          <strong>Technical data</strong> — IP addresses and request details in short-lived server
          logs, and the IP address of SMTP connections, used to detect and block abuse such as
          repeated failed logins.
        </li>
      </ul>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <>
        <ul>
          <li>To provide the Service: authenticate you, and sign, deliver and track your email.</li>
          <li>To keep the Service secure: rate limiting, abuse and spam detection, lockouts.</li>
          <li>To process payments and keep billing records.</li>
          <li>
            To email you about your account — verification links, password resets, and important
            service or policy notices.
          </li>
          <li>
            To comply with the law and enforce our <Link to="/terms">Terms of Service</Link>.
          </li>
        </ul>
        <p>
          We do not sell your data, and we do not read the content of your emails except where
          needed to investigate abuse or a problem you report. We do measure advertising: see
          cookies and browser storage below.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and browser storage',
    body: (
      <>
        <p>
          We use one essential, secure cookie to keep you signed in, and your browser’s local
          storage to hold a short-lived sign-in token. Neither is used to track you.
        </p>
        <p>
          The site also loads the Google Ads tag (gtag.js), which sets Google cookies and tells us
          when an advert led to a sign-up. It loads on every page, including while you are signed
          in, but it is never given your email content, recipients, delivery logs or SMTP
          credentials. To opt out, use your browser&apos;s cookie controls, a content blocker, or
          Google&apos;s{' '}
          <a href="https://adssettings.google.com" rel="noreferrer noopener" target="_blank">
            Ads Settings
          </a>
          . The site also loads the Inter font from Google Fonts, so Google receives your IP address
          when a page loads.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>We share data only with providers that help us run the Service, and only as needed:</p>
        <ul>
          <li>
            <strong>Razorpay</strong> — payment processing.
          </li>
          <li>
            <strong>Hetzner</strong> — the servers that run the Service, located in Finland.
          </li>
          <li>
            <strong>MongoDB Atlas</strong> — database hosting.
          </li>
          <li>
            <strong>Google</strong> — web fonts, and advertising measurement through the Google Ads
            tag on our public pages.
          </li>
          <li>
            <strong>Recipient mail servers</strong> — the emails you send are, by their nature,
            delivered to your recipients’ email providers.
          </li>
        </ul>
        <p>
          We may also disclose data when required by law or a valid legal request, or to protect the
          Service, our users or the public from fraud, abuse or harm. Because our providers operate
          outside India, your data may be stored and processed in other countries.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>
          <strong>Email content</strong> — deleted automatically 7 days after we accept the message.
        </li>
        <li>
          <strong>Email records and delivery logs</strong> (what you see in Activity) — deleted
          automatically after 30 days.
        </li>
        <li>
          <strong>Suppression list</strong> — kept while your account exists, to protect your
          sending reputation.
        </li>
        <li>
          <strong>Account and sending setup</strong> — kept until your account is deleted.
        </li>
        <li>
          <strong>Billing records</strong> — kept for as long as tax and accounting laws require.
        </li>
        <li>
          <strong>Server logs</strong> — rotated and overwritten after a short period. Verification
          and password-reset links expire after 24 hours and 1 hour.
        </li>
      </ul>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <p>
        We use TLS encryption for the website and for SMTP connections, store passwords only as
        strong hashes, encrypt DKIM signing keys, and restrict access to production systems. No
        system is perfectly secure, so please use a strong, unique password and keep your SMTP
        credentials private.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Under India’s Digital Personal Data Protection Act, 2023 and other laws that may apply to
          you, you can ask us to:
        </p>
        <ul>
          <li>tell you what personal data we hold about you, and how we use it;</li>
          <li>correct or update inaccurate data;</li>
          <li>delete your account and personal data (except records we must keep by law);</li>
          <li>withdraw consent where we rely on it; and</li>
          <li>address a grievance about how we handle your data.</li>
        </ul>
        <p>
          Email <Mail /> from your account’s email address. We aim to respond within 30 days. You
          can update most account and sending settings yourself in the dashboard.
        </p>
      </>
    ),
  },
  {
    id: 'recipients',
    title: 'If you received an email sent through us',
    body: (
      <p>
        Emails sent through {BRAND} come from our customers, who control their content and mailing
        lists. To unsubscribe or ask about your data, contact the sender. To report spam or abuse
        sent through our servers, email <Mail /> with the full message headers.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        The Service is not intended for anyone under 18, and we do not knowingly collect their data.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. The “Last updated” date above shows when it last changed; for
        material changes we will also notify you by email or in the dashboard.
      </p>
    ),
  },
];

export function Privacy() {
  return (
    <DocPage
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle={`Last updated ${LEGAL_UPDATED}`}
      numbered
      intro={
        <p>
          Plain version: we collect what we need to send your email and bill you, delete email
          content after 7 days and delivery logs after 30, never sell your data, and let payments go
          through Razorpay so we never see your card or UPI details. The site carries a Google Ads
          tag so we can tell which adverts work.
        </p>
      }
      sections={sections}
      footer={
        <>
          Questions about this page? Email <Mail />. See also our{' '}
          <Link to="/terms">Terms of Service</Link>.
        </>
      }
    />
  );
}
