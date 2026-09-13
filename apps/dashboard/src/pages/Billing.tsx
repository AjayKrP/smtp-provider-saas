import { useSearchParams } from 'react-router-dom';
import { useCheckout, useMe, usePlans, usePortal, useUsage } from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { PlanCards } from '../components/PlanCards.js';
import { PageHeader, StatusBadge } from '../components/bits.js';

export function Billing() {
  const plans = usePlans();
  const usage = useUsage();
  const me = useMe();
  const checkout = useCheckout();
  const portal = usePortal();
  const [params] = useSearchParams();
  const current = usage.data?.planKey;
  const currentPrice = plans.data?.find((p) => p.key === current)?.priceUsd ?? 0;
  const result = params.get('checkout');

  async function pick(planKey: string) {
    try {
      const { url } = await checkout.mutateAsync(planKey);
      if (url) window.location.href = url;
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  async function manage() {
    try {
      const { url } = await portal.mutateAsync();
      if (url) window.location.href = url;
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Billing" description="Choose the plan that fits your sending volume." />

      {result === 'success' && (
        <div className="banner" style={{ background: 'var(--ok-soft)' }}>
          Payment received — your new plan will be active in a moment.
        </div>
      )}
      {result === 'cancelled' && (
        <div className="banner">Checkout was cancelled. No changes were made.</div>
      )}

      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>
              Current plan: {usage.data?.planName ?? '—'}{' '}
              {usage.data && (
                <StatusBadge status={usage.data.subscriptionActive ? 'active' : 'inactive'} />
              )}
            </h2>
            <p>
              {usage.data
                ? `${usage.data.remaining.toLocaleString()} of ${usage.data.monthlyEmailQuota.toLocaleString()} emails remaining this month`
                : 'Loading…'}
            </p>
          </div>
          {me.data?.organization?.stripeCustomerId && (
            <button onClick={manage} disabled={portal.isPending}>
              {portal.isPending ? 'Opening…' : 'Manage subscription'}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <PlanCards
          plans={plans.data}
          loading={plans.isLoading}
          featuredKey={params.get('plan') ?? undefined}
          action={(p, featured) =>
            p.key === current ? (
              <button className="block" disabled>
                Current plan
              </button>
            ) : p.requiresCheckout ? (
              <button
                className={`block${featured ? ' primary' : ''}`}
                onClick={() => pick(p.key)}
                disabled={checkout.isPending}
              >
                {checkout.isPending && checkout.variables === p.key
                  ? 'Redirecting…'
                  : `${p.priceUsd > currentPrice ? 'Upgrade' : 'Switch'} to ${p.name}`}
              </button>
            ) : (
              <button className="block" disabled>
                Free tier
              </button>
            )
          }
        />
      </div>
    </>
  );
}
