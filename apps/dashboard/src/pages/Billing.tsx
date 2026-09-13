import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePayments, usePlans, usePurchase, useSubscription, useUsage } from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { CheckoutDismissed } from '../api/razorpay.js';
import { PlanCards } from '../components/PlanCards.js';
import { Empty, PageHeader, StatusBadge, day, money } from '../components/bits.js';

export function Billing() {
  const plans = usePlans();
  const usage = useUsage();
  const subscription = useSubscription();
  const payments = usePayments();
  const purchase = usePurchase();
  const [params] = useSearchParams();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const sub = subscription.data;
  const planName = (key: string | null | undefined) =>
    plans.data?.find((p) => p.key === key)?.name ?? key ?? '—';
  const activePaidKey = sub?.current ? sub.planKey : null;
  const buying = purchase.isPending ? purchase.variables : null;

  async function buy(planKey: string) {
    setNotice(null);
    try {
      const result = await purchase.mutateAsync(planKey);
      setNotice({
        ok: true,
        text: `Payment received — ${planName(result.planKey)} is active until ${day(result.currentPeriodEnd)}.`,
      });
    } catch (err) {
      if (err instanceof CheckoutDismissed) return;
      setNotice({ ok: false, text: apiErrorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader
        title="Billing"
        description="Plans are prepaid one month at a time. Pay with UPI, cards, netbanking or wallets."
      />

      {notice && (
        <div
          className={`banner${notice.ok ? '' : ' err'}`}
          style={notice.ok ? { background: 'var(--ok-soft)' } : undefined}
        >
          {notice.text}
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            {sub?.current ? (
              <>
                <h2>
                  {planName(sub.planKey)} plan{' '}
                  {sub.lifetime ? (
                    <span className="badge accent">lifetime</span>
                  ) : (
                    <StatusBadge status="active" />
                  )}
                </h2>
                <p>
                  {sub.lifetime ? (
                    'Complimentary lifetime access — nothing to pay or renew'
                  ) : (
                    <>
                      Paid until <strong>{day(sub.currentPeriodEnd)}</strong>
                    </>
                  )}
                  {usage.data &&
                    ` · ${usage.data.remaining.toLocaleString()} emails left this month`}
                </p>
              </>
            ) : sub?.planKey ? (
              <>
                <h2>
                  {planName(sub.planKey)} plan <span className="badge err">expired</span>
                </h2>
                <p>
                  Ended on {day(sub.currentPeriodEnd)}. You&apos;re on the Free plan&apos;s limits
                  until you renew.
                </p>
              </>
            ) : (
              <>
                <h2>Free plan</h2>
                <p>
                  {usage.data
                    ? `${usage.data.remaining.toLocaleString()} of ${usage.data.monthlyEmailQuota.toLocaleString()} emails left this month`
                    : 'Loading…'}
                </p>
              </>
            )}
          </div>
          {sub?.planKey && !sub.lifetime && (
            <button
              className={sub.current ? '' : 'primary'}
              onClick={() => buy(sub.planKey!)}
              disabled={purchase.isPending}
            >
              {buying === sub.planKey
                ? 'Opening…'
                : sub.current
                  ? 'Extend by 1 month'
                  : `Renew ${planName(sub.planKey)}`}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <PlanCards
          plans={plans.data}
          loading={plans.isLoading}
          featuredKey={params.get('plan') ?? undefined}
          action={(p, featured) => {
            if (sub?.lifetime && sub.current) {
              return (
                <button className="block" disabled>
                  {p.key === sub.planKey ? 'Lifetime access' : 'Not needed'}
                </button>
              );
            }
            if (!p.requiresCheckout) {
              return (
                <button className="block" disabled>
                  {activePaidKey ? 'Free tier' : 'Current plan'}
                </button>
              );
            }
            if (!p.price) {
              return (
                <button className="block" disabled>
                  Unavailable
                </button>
              );
            }
            const label =
              p.key === activePaidKey
                ? 'Extend by 1 month'
                : activePaidKey
                  ? `Switch to ${p.name}`
                  : `Buy ${p.name}`;
            return (
              <button
                className={`block${featured || p.key === activePaidKey ? ' primary' : ''}`}
                onClick={() => buy(p.key)}
                disabled={purchase.isPending}
              >
                {buying === p.key ? 'Opening…' : label}
              </button>
            );
          }}
        />
        {!sub?.lifetime && (
          <p className="muted small" style={{ marginTop: 14, textAlign: 'center' }}>
            Each payment covers one month and never renews automatically. Paying for your current
            plan adds a month to it; switching plans starts a new month today.
          </p>
        )}
      </div>

      <div className="card flush" style={{ marginTop: 32 }}>
        <div className="card-head">
          <h2>Payment history</h2>
        </div>
        {payments.data?.length ? (
          <div
            className="table-wrap"
            style={{ marginTop: 16, borderTop: '1px solid var(--border)' }}
          >
            <table>
              <thead>
                <tr>
                  <th>Paid on</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Covers</th>
                  <th>Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.map((p) => (
                  <tr key={p.id}>
                    <td>{day(p.paidAt)}</td>
                    <td>{planName(p.planKey)}</td>
                    <td className="num">{money(p.amount, p.currency, { exact: true })}</td>
                    <td className="muted">
                      {day(p.periodStart)} – {day(p.periodEnd)}
                    </td>
                    <td>
                      <code>{p.razorpayPaymentId}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="card" title="No payments yet">
            Payments you make will be listed here.
          </Empty>
        )}
      </div>
    </>
  );
}
