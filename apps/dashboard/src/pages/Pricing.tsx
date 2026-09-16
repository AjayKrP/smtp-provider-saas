import { Link } from 'react-router-dom';
import { usePlans } from '../api/hooks.js';
import { PlanCards } from '../components/PlanCards.js';
import { Icon } from '../components/bits.js';
import { FAQ } from '../content/faq.js';

export function PricingSection({
  id,
  heading = 'h2',
}: {
  id?: string;
  /** 'h1' when this section is the whole page; 'h2' when embedded below the landing H1. */
  heading?: 'h1' | 'h2';
}) {
  const Heading = heading;
  const { data, isLoading } = usePlans();
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <span className="eyebrow">Pricing</span>
        <Heading>Affordable pricing that grows with your app</Heading>
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
              {p.requiresCheckout ? `Choose ${p.name}` : 'Start for free'}
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
      <PricingSection heading="h1" />
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
