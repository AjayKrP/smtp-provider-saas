import { Link } from 'react-router-dom';
import { usePlans } from '../api/hooks.js';
import { PlanCards } from '../components/PlanCards.js';
import { Icon } from '../components/bits.js';

const FAQ = [
  {
    q: 'I built my app with an AI tool. Will this work?',
    a: 'Yes. We use standard SMTP, which every framework and AI coding assistant already knows. Copy the AI prompt from the home page into Cursor, Claude, Lovable, Bolt or Replit, add your credentials as environment variables, and it wires up the rest.',
  },
  {
    q: 'Is there really a free plan?',
    a: 'Yes — 500 emails a month on one domain, free, with no credit card. It is plenty for a side project or an MVP; upgrade when you outgrow it.',
  },
  {
    q: 'What counts as an email?',
    a: 'Every recipient of a message accepted by our SMTP server counts as one email. Quotas reset at the start of each calendar month.',
  },
  {
    q: 'How does billing work?',
    a: 'Plans are prepaid one month at a time through Razorpay — pay with UPI, cards, netbanking or wallets. Nothing renews automatically: when a month ends you move to the Free limits until you pay again.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Buy a different plan from the Billing page whenever you like and it starts right away. Paying for the plan you are already on adds another month to it.',
  },
  {
    q: 'What happens if I hit my monthly limit?',
    a: 'New messages are rejected with a temporary SMTP error until the next month or until you upgrade, so your app can retry safely.',
  },
  {
    q: 'Do I need to change my code?',
    a: 'No. Any library, framework or mail client that speaks SMTP works — just swap in the host, port and credentials from your dashboard.',
  },
];

export function PricingSection({ id }: { id?: string }) {
  const { data, isLoading } = usePlans();
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <span className="eyebrow">Pricing</span>
        <h2>Affordable pricing that grows with your app</h2>
        <p>
          Start free. Pay a month at a time only when you need more — no card on file, no
          auto-renew, no overage fees.
        </p>
      </div>
      <PlanCards
        plans={data}
        loading={isLoading}
        action={(p, featured) =>
          p.requiresCheckout && !p.price ? (
            <button className="block" disabled>
              Unavailable
            </button>
          ) : (
            <Link
              to={p.requiresCheckout ? `/register?plan=${p.key}` : '/register'}
              className={`btn block${featured ? ' primary' : ''}`}
            >
              {p.requiresCheckout ? `Get ${p.name}` : 'Start for free'}
            </Link>
          )
        }
      />
    </section>
  );
}

export function Pricing() {
  return (
    <>
      <PricingSection />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <h2>Questions &amp; answers</h2>
        </div>
        <div className="faq">
          {FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="chevron" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
