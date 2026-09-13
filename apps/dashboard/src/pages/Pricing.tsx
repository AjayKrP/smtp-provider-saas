import { Link } from 'react-router-dom';
import { usePlans } from '../api/hooks.js';
import { PlanCards } from '../components/PlanCards.js';
import { Icon } from '../components/bits.js';

const FAQ = [
  {
    q: 'What counts as an email?',
    a: 'Every recipient of a message accepted by our SMTP server counts as one email. Quotas reset at the start of each calendar month.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade from the Billing page at any time, and manage or cancel your subscription through the Stripe customer portal.',
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
        <h2>Simple, predictable pricing</h2>
        <p>Start free. Upgrade when you grow. No per-seat fees.</p>
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
