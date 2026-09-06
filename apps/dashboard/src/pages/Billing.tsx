import { useCheckout, usePlans, usePortal, useUsage } from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';

export function Billing() {
  const plans = usePlans();
  const usage = useUsage();
  const checkout = useCheckout();
  const portal = usePortal();
  const current = usage.data?.planKey;

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
      <h1>Billing</h1>

      <div className="card">
        <h2>Current plan</h2>
        <p>
          {usage.data?.planName ?? '—'} — {usage.data?.subscriptionActive ? 'active' : 'inactive'}
        </p>
        <button onClick={manage} disabled={portal.isPending}>
          Manage subscription
        </button>
      </div>

      <div className="grid">
        {plans.data?.map((p) => (
          <div className="card" key={p.key} style={{ margin: 0 }}>
            <h2>{p.name}</h2>
            <p style={{ fontSize: 20 }}>
              ${p.priceUsd}
              <span className="muted" style={{ fontSize: 12 }}>
                /mo
              </span>
            </p>
            <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              <li>{p.monthlyEmailQuota.toLocaleString()} emails / month</li>
              <li>{p.maxDomains} domains</li>
              <li>{p.maxCredentials} SMTP credentials</li>
              <li>{p.maxRecipientsPerMessage} recipients / message</li>
            </ul>
            {p.key === current ? (
              <button disabled>Current</button>
            ) : p.requiresCheckout ? (
              <button className="primary" onClick={() => pick(p.key)} disabled={checkout.isPending}>
                Choose {p.name}
              </button>
            ) : (
              <button disabled>Free tier</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
