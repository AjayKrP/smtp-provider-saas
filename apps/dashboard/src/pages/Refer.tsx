import { Link } from 'react-router-dom';
import { usePublicConfig } from '../api/hooks.js';
import { DocPage, Mail, type DocSection } from '../components/DocPage.js';
import { money } from '../components/bits.js';

/**
 * The public page a share link's recipient — or a prospective referrer — can read before
 * signing in. The numbers come from the API's public config, which is the same
 * configuration the program enforces, so the page cannot advertise terms we do not honour.
 *
 * The fallbacks matter: the build prerenders this route with queries disabled, so they are
 * what crawlers and link previews see.
 */
function sectionsFor(percent: number, holdDays: number, minimum: number): DocSection[] {
  return [
    {
      id: 'how-it-works',
      title: 'How it works',
      body: (
        <>
          <ol>
            <li>
              <strong>Create an account</strong> — the free plan is enough, and no card is needed.
              Your referral link appears under <strong>Refer &amp; earn</strong>.
            </li>
            <li>
              <strong>Share it</strong> with anyone who needs transactional email: a friend shipping
              a side project, a client whose signup emails are going to spam, your followers.
            </li>
            <li>
              <strong>Earn {percent}% of every payment they make</strong> — not just their first
              one. For as long as they keep paying, you keep earning.
            </li>
            <li>
              <strong>Withdraw to your bank account</strong> once your balance clears{' '}
              {money(minimum, 'INR')}.
            </li>
          </ol>
          <p>
            Attribution is recorded when they sign up and never changes afterwards, so you do not
            lose a referral because they came back later through a different link.
          </p>
        </>
      ),
    },
    {
      id: 'what-you-earn',
      title: 'What you actually earn',
      body: (
        <>
          <p>
            {percent}% of each payment, not of the first month only. Someone on a plan who stays a
            year earns you {percent}% twelve times over. There is no cap and no expiry on the
            relationship.
          </p>
          <p>
            Commission is held for {holdDays} days before it can be withdrawn. That window exists so
            that if the payment behind it is refunded, the commission can be cancelled while the
            money is still here rather than clawed back from you later.
          </p>
          <p>
            Payouts are made in rupees to an Indian bank account and need your PAN, because
            commission is taxable income and any tax we are required to withhold is reported against
            it. Each payout is reviewed before the transfer goes out.
          </p>
        </>
      ),
    },
    {
      id: 'good-referrals',
      title: 'What counts, and what does not',
      body: (
        <>
          <p>
            This program is for genuine recommendations. A recommendation is someone choosing to use
            the service because you told them it was good.
          </p>
          <p>
            Which means these earn nothing, and will close your referral account: signing up through
            your own link, creating accounts for people who did not ask, buying traffic, spamming
            the link anywhere, bidding on our name in paid search, or claiming things about the
            service that are not true. We would rather have ten real referrals than a thousand
            signups that never send an email.
          </p>
          <p>
            The full terms are in <Link to="/terms#referrals">section 13 of the Terms</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'why-refer',
      title: 'Why anyone takes the recommendation',
      body: (
        <>
          <p>
            Worth knowing, since you are the one vouching for it. The service is plain SMTP on ports
            587 and 465 — no SDK, four settings, and nothing to rewrite if they ever leave. Every
            message is DKIM-signed for their own domain, and the delivery log shows the receiving
            server&apos;s actual reply rather than a &ldquo;sent&rdquo; tick.
          </p>
          <p>
            Plans are prepaid in rupees through UPI or a card, never auto-renew, and have no overage
            charges. For a lot of Indian developers that last part is the whole reason this exists:
            most providers bill in dollars and need an international card.
          </p>
          <p>
            The free plan sends 500 emails a month with no card, so a recommendation costs the
            person you send nothing to try.
          </p>
        </>
      ),
    },
  ];
}

export function Refer() {
  const config = usePublicConfig().data?.referral;
  const percent = config?.percent ?? 10;
  const holdDays = config?.holdDays ?? 14;
  const minimum = config?.minimumPayout ?? 50_000;

  return (
    <DocPage
      eyebrow="Refer & earn"
      title={`Earn ${percent}% of every payment, for as long as they stay`}
      subtitle="Recommend the service to people who need email for their apps, and take a share of what they pay — recurring, not one-off."
      intro={
        <p>
          There is no application and no minimum audience. Every account has a referral link from
          the day it is created, including free ones.
        </p>
      }
      sections={sectionsFor(percent, holdDays, minimum)}
      footer={
        <>
          Questions about the program? Email <Mail />. Already have an account?{' '}
          <Link to="/referrals">Your link is here</Link>.
        </>
      }
    />
  );
}
