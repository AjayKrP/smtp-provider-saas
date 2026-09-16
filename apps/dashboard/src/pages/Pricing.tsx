import { Link } from 'react-router-dom';
import { usePlans } from '../api/hooks.js';
import { PlanCards } from '../components/PlanCards.js';
import { Icon } from '../components/bits.js';
import { FAQ } from '../content/faq.js';


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
