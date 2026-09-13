import type { ReactNode } from 'react';
import type { Plan } from '../api/hooks.js';
import { Icon } from './bits.js';

const INCLUDED = [
  'DKIM signing & SPF alignment',
  'TLS on ports 587 and 465',
  'Delivery logs & bounce tracking',
];

function perThousand(p: Plan): string {
  if (p.priceUsd === 0) return 'No credit card required';
  const cost = p.priceUsd / (p.monthlyEmailQuota / 1000);
  return `$${cost.toFixed(2)} per 1,000 emails`;
}

export function PlanCards({
  plans,
  loading,
  featuredKey,
  action,
}: {
  plans: Plan[] | undefined;
  loading?: boolean;
  /** Plan to highlight; defaults to the middle plan. */
  featuredKey?: string;
  action: (plan: Plan, featured: boolean) => ReactNode;
}) {
  if (loading || !plans) {
    return (
      <div className="plans">
        {[0, 1, 2].map((i) => (
          <div key={i} className="plan skeleton" />
        ))}
      </div>
    );
  }

  const featured =
    featuredKey ?? (plans.length >= 3 ? plans[Math.floor(plans.length / 2)]?.key : undefined);

  return (
    <div className="plans">
      {plans.map((p) => {
        const isFeatured = p.key === featured;
        return (
          <div key={p.key} className={`plan${isFeatured ? ' featured' : ''}`}>
            {isFeatured && <span className="tag">Most popular</span>}
            <h3>{p.name}</h3>
            <div className="price">
              <strong>${p.priceUsd}</strong>
              <span>/ month</span>
            </div>
            <div className="per">{perThousand(p)}</div>
            <ul>
              <li>
                <Icon name="check" />
                <span>
                  <b>{p.monthlyEmailQuota.toLocaleString()}</b> emails / month
                </span>
              </li>
              <li>
                <Icon name="check" />
                <span>
                  <b>{p.maxDomains}</b> sending {p.maxDomains === 1 ? 'domain' : 'domains'}
                </span>
              </li>
              <li>
                <Icon name="check" />
                <span>
                  <b>{p.maxCredentials}</b> SMTP{' '}
                  {p.maxCredentials === 1 ? 'credential' : 'credentials'}
                </span>
              </li>
              <li>
                <Icon name="check" />
                <span>
                  Up to <b>{p.maxRecipientsPerMessage}</b> recipients / message
                </span>
              </li>
              {INCLUDED.map((f) => (
                <li key={f}>
                  <Icon name="check" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {action(p, isFeatured)}
          </div>
        );
      })}
    </div>
  );
}
