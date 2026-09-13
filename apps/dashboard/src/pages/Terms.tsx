import { Link } from 'react-router-dom';
import { BRAND } from '../components/bits.js';
import { LegalPage, Mail, type LegalSection } from '../components/LegalPage.js';

export const LEGAL_UPDATED = '13 September 2026';

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement to these terms',
    body: (
      <>
        <p>
          These Terms of Service govern your use of {BRAND} — the website, dashboard, API and SMTP
          email-sending service (together, the “Service”), operated from India. By creating an
          account or using the Service you agree to these terms and to our{' '}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
        </p>
        <p>
          You must be at least 18 years old. If you use the Service for a company or other
          organization, you confirm you are authorized to accept these terms on its behalf.
        </p>
      </>
    ),
  },
  {
    id: 'service',
    title: 'The Service',
    body: (
      <p>
        {BRAND} lets you send email from your own applications through our SMTP servers. You add and
        verify domains you control, create SMTP credentials, and we sign and deliver the messages
        you submit to the recipients’ mail servers. We may add, change or remove features over time.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account and credentials',
    body: (
      <ul>
        <li>Give accurate information and confirm your email address before signing in.</li>
        <li>
          Keep your password and SMTP credentials secret. You are responsible for all activity and
          all email sent using your account or credentials.
        </li>
        <li>
          Tell us promptly at <Mail /> if you believe your account or credentials have been
          compromised, and revoke affected credentials from the dashboard.
        </li>
        <li>Only add sending domains that you own or are authorized to send from.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use and anti-spam rules',
    body: (
      <>
        <p>
          Email reputation is shared by everyone who sends through our servers, so these rules are
          strictly enforced. You must not use the Service to send, or help send:
        </p>
        <ul>
          <li>
            Unsolicited email (spam), including to purchased, rented, scraped or harvested address
            lists, or to people who have not asked to hear from you.
          </li>
          <li>
            Phishing, malware, scams, fraud, or messages that impersonate another person, brand or
            organization, or hide or falsify who they are from.
          </li>
          <li>
            Content that is illegal, infringes others’ rights, or is abusive, harassing, hateful or
            sexually exploitative.
          </li>
        </ul>
        <p>You also agree to:</p>
        <ul>
          <li>
            Include a working unsubscribe method in any marketing email and honour opt-outs
            promptly.
          </li>
          <li>
            Follow the laws that apply to your email, such as India’s Information Technology Act,
            2000 and Digital Personal Data Protection Act, 2023, and — where they apply to your
            recipients — laws like CAN-SPAM and the GDPR.
          </li>
          <li>
            Keep bounce and spam-complaint rates low, and stop emailing addresses that bounce or
            complain.
          </li>
          <li>
            Not attack, probe or overload the Service, work around sending limits or quotas, or
            resell access without our written permission.
          </li>
        </ul>
        <p>
          We monitor delivery data such as bounces, complaints and sending patterns to detect abuse,
          and may block messages or accounts that break these rules.
        </p>
      </>
    ),
  },
  {
    id: 'limits',
    title: 'Plans, limits and quotas',
    body: (
      <p>
        Each plan includes the limits shown on the <Link to="/pricing">Pricing</Link> page, such as
        emails per month, domains, credentials and recipients per message. When a limit is reached,
        new messages are rejected with a temporary error until the limit resets or you change plan.
        We may apply additional rate limits to protect the Service and its deliverability.
      </p>
    ),
  },
  {
    id: 'payments',
    title: 'Payments and refunds',
    body: (
      <>
        <ul>
          <li>
            Paid plans are prepaid for one month at a time at the price shown when you pay,
            including any applicable taxes. Plans do not renew automatically; when a paid month ends
            your account moves to the free Vibe plan’s limits until you pay again.
          </li>
          <li>
            Payments are processed by Razorpay. We never receive or store your card, UPI or bank
            details. Razorpay’s own terms apply to the payment.
          </li>
          <li>
            <strong>All payments are non-refundable</strong>, including for unused time, unused
            emails, or when an account is suspended or terminated for breaking these terms.
          </li>
          <li>
            The only exception is a duplicate or erroneous charge — for example, being charged twice
            for the same order, or being charged when the plan was not activated. Email <Mail />{' '}
            within 30 days of the charge with the Razorpay payment ID and we will refund the
            incorrect amount.
          </li>
          <li>
            Price changes apply only to purchases made after the change. We may offer free or
            complimentary plans at our discretion and withdraw them with notice.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'suspension',
    title: 'Suspension and termination',
    body: (
      <>
        <p>
          We may suspend or terminate your account, revoke credentials or block messages if you
          break these terms, if your sending threatens the Service, our IP reputation or other
          customers, if required by law, or if the account appears compromised. Where reasonable we
          will tell you first, but we may act immediately to stop abuse.
        </p>
        <p>
          You may stop using the Service at any time and ask us to delete your account by emailing{' '}
          <Mail /> from your account’s email address.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <p>
        You keep ownership of the email content and data you send through the Service. You grant us
        permission to store, process and transmit it only as needed to provide the Service, as
        described in the <Link to="/privacy">Privacy Policy</Link>. You are responsible for your
        content and for having the rights and recipient consent needed to send it.
      </p>
    ),
  },
  {
    id: 'delivery',
    title: 'Delivery is not guaranteed',
    body: (
      <p>
        Recipient mail providers decide whether to accept, filter or reject email. We work to
        deliver your messages reliably, but we cannot guarantee delivery, inbox placement or
        delivery times, and we are not responsible for blocklisting or filtering caused by your
        content, lists or sending practices.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and warranty disclaimer',
    body: (
      <p>
        The Service is provided “as is” and “as available”. We do not promise that it will be
        uninterrupted, error-free or available at any particular time, and we may carry out
        maintenance that affects availability. To the extent the law allows, we disclaim all implied
        warranties, including merchantability and fitness for a particular purpose.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the maximum extent permitted by law, {BRAND} is not liable for any indirect, incidental,
        special or consequential damages, or for lost profits, revenue, data or goodwill. Our total
        liability for any claim relating to the Service is limited to the amount you paid us in the
        three months before the event giving rise to the claim.
      </p>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You agree to indemnify and hold us harmless from claims, losses and costs (including
        reasonable legal fees) arising from the email you send, your content, or your breach of
        these terms or of the law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms. The “Last updated” date above shows when they last changed; for
        material changes we will also notify you by email or in the dashboard. Continuing to use the
        Service after changes take effect means you accept them.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of India, and the courts of India have jurisdiction
        over any dispute arising from them or from the Service.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        {BRAND} — email <Mail /> for questions about these terms, billing, or to report abuse of the
        Service.
      </p>
    ),
  },
];

export function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro={
        <p>
          Plain version: send only email people want, from domains you control; keep your
          credentials safe; paid months are prepaid and non-refundable except for billing mistakes;
          and we may suspend accounts that spam.
        </p>
      }
      sections={sections}
    />
  );
}
