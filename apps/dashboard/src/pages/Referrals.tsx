import { useState } from 'react';
import { apiErrorMessage } from '../api/client.js';
import {
  useReferrals,
  useRequestPayout,
  useSavePayoutAccount,
  type PayoutAccountInput,
  type ReferralSummary,
} from '../api/hooks.js';
import { CopyButton, Empty, PageHeader, StatusBadge, day, money } from '../components/bits.js';

/** Amounts arrive in paise, as Razorpay charges and pays them. */
const inr = (amount: number, currency: string) => money(amount, currency);

function Earnings({ summary }: { summary: ReferralSummary }) {
  const { earnings, terms } = summary;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Earnings</h2>
          <p className="muted">
            {terms.percent}% of every payment made by someone who signs up through your link, for as
            long as they keep paying.
          </p>
        </div>
      </div>
      <div className="grid">
        <div className="stat">
          <div className="label">Ready to withdraw</div>
          <div className="value">{inr(earnings.available, earnings.currency)}</div>
        </div>
        <div className="stat">
          <div className="label">Held for {terms.holdDays} days</div>
          <div className="value">{inr(earnings.pending, earnings.currency)}</div>
        </div>
        <div className="stat">
          <div className="label">Paid to you</div>
          <div className="value">{inr(earnings.paid, earnings.currency)}</div>
        </div>
        <div className="stat">
          <div className="label">Signed up · paying</div>
          <div className="value">
            {summary.stats.referred} · {summary.stats.paying}
          </div>
        </div>
      </div>
      <p className="muted small">
        A commission is held for {terms.holdDays} days before it can be withdrawn, so a refunded
        payment can be corrected while the money is still here. Minimum payout{' '}
        {inr(terms.minimumPayout, terms.currency)}.
        {terms.withholdingPercent > 0
          ? ` Tax of ${terms.withholdingPercent}% is withheld from each payout and reported against your PAN.`
          : ''}
      </p>
    </div>
  );
}

function ShareLink({ summary }: { summary: ReferralSummary }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Your link</h2>
          <p className="muted">
            Anyone who signs up through this is attributed to you permanently.
          </p>
        </div>
      </div>
      <div className="copy-field">
        <code>{summary.shareUrl}</code>
        <CopyButton value={summary.shareUrl} label="Copy referral link" />
      </div>
      <p className="muted small">
        Your code is <strong>{summary.code}</strong>. It works on its own too, if someone would
        rather type it than follow a link.
      </p>
    </div>
  );
}

const EMPTY_ACCOUNT: PayoutAccountInput = {
  holderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  pan: '',
};

function PayoutAccountForm({ summary }: { summary: ReferralSummary }) {
  const saved = summary.payoutAccount;
  const [open, setOpen] = useState(!saved);
  const [form, setForm] = useState<PayoutAccountInput>(EMPTY_ACCOUNT);
  const [error, setError] = useState('');
  const save = useSavePayoutAccount();

  const set = (key: keyof PayoutAccountInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await save.mutateAsync({ ...form, bankName: form.bankName || undefined });
      setForm(EMPTY_ACCOUNT);
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Where payouts go</h2>
          <p className="muted">
            An Indian bank account and your PAN. Both are stored encrypted, and only the last four
            digits are ever shown back to you.
          </p>
        </div>
        {saved && !open && (
          <button type="button" className="btn sm" onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </div>

      {saved && !open && (
        <table className="doc-table">
          <tbody>
            <tr>
              <td>Account holder</td>
              <td>{saved.holderName}</td>
            </tr>
            <tr>
              <td>Account</td>
              <td>
                <code>•••• {saved.accountNumberLast4}</code>
                {saved.bankName ? ` · ${saved.bankName}` : ''}
              </td>
            </tr>
            <tr>
              <td>IFSC</td>
              <td>
                <code>{saved.ifsc}</code>
              </td>
            </tr>
            <tr>
              <td>PAN</td>
              <td>{saved.panLast4 ? <code>••••• {saved.panLast4}</code> : 'Not provided'}</td>
            </tr>
            <tr>
              <td>Confirmed</td>
              <td className="muted">
                {saved.confirmedAt
                  ? `A payout to this account succeeded on ${day(saved.confirmedAt)}`
                  : 'Not yet — the first successful payout confirms these details'}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {open && (
        <form onSubmit={submit}>
          <label htmlFor="holderName">Name as printed on the account</label>
          <input id="holderName" value={form.holderName} onChange={set('holderName')} required />

          <label htmlFor="accountNumber">Account number</label>
          <input
            id="accountNumber"
            value={form.accountNumber}
            onChange={set('accountNumber')}
            inputMode="numeric"
            autoComplete="off"
            required
          />

          <label htmlFor="ifsc">IFSC</label>
          <input
            id="ifsc"
            value={form.ifsc}
            onChange={set('ifsc')}
            placeholder="HDFC0001234"
            autoComplete="off"
            required
          />

          <label htmlFor="bankName">Bank name (optional)</label>
          <input id="bankName" value={form.bankName ?? ''} onChange={set('bankName')} />

          <label htmlFor="pan">PAN</label>
          <input
            id="pan"
            value={form.pan}
            onChange={set('pan')}
            placeholder="ABCDE1234F"
            autoComplete="off"
            required
          />

          {error && <p className="error">{error}</p>}
          <div className="row">
            <button type="submit" className="btn primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save details'}
            </button>
            {saved && (
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function PayoutHistory({ summary }: { summary: ReferralSummary }) {
  const request = useRequestPayout();
  const [error, setError] = useState('');
  const ready = summary.earnings.available >= summary.terms.minimumPayout;

  async function withdraw() {
    setError('');
    try {
      await request.mutateAsync();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Payouts</h2>
          <p className="muted">
            Requested payouts are reviewed before the transfer is made, usually within a few working
            days.
          </p>
        </div>
        <button
          type="button"
          className="btn primary sm"
          onClick={() => void withdraw()}
          disabled={!ready || request.isPending}
          title={
            ready
              ? undefined
              : `You need at least ${inr(summary.terms.minimumPayout, summary.terms.currency)} available`
          }
        >
          {request.isPending ? 'Requesting…' : 'Request payout'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {summary.payouts.length === 0 ? (
        <Empty icon="wallet" title="No payouts yet">
          Once your available balance clears the minimum, you can request a transfer here.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Commission</th>
                <th>Withheld</th>
                <th>You receive</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.payouts.map((p) => (
                <tr key={p.id}>
                  <td>{day(p.requestedAt)}</td>
                  <td>{inr(p.grossAmount, p.currency)}</td>
                  <td>{p.withheldAmount ? inr(p.withheldAmount, p.currency) : '—'}</td>
                  <td>{inr(p.netAmount, p.currency)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.failureReason && <div className="muted small">{p.failureReason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommissionList({ summary }: { summary: ReferralSummary }) {
  if (summary.commissions.length === 0) return null;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Recent commission</h2>
          <p className="muted">One entry per payment made by someone you referred.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Earned</th>
              <th>Amount</th>
              <th>Withdrawable</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.commissions.map((c) => (
              <tr key={c.id}>
                <td>{day(c.createdAt)}</td>
                <td>{inr(c.amount, c.currency)}</td>
                <td className="muted">{day(c.availableAt)}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Referrals() {
  const { data, isLoading, error } = useReferrals();

  return (
    <div className="container">
      <PageHeader
        title="Refer & earn"
        description="Share your link and earn a share of every payment from the people you bring."
      />
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{apiErrorMessage(error)}</p>}
      {data && (
        <>
          <ShareLink summary={data} />
          <Earnings summary={data} />
          <PayoutAccountForm summary={data} />
          <PayoutHistory summary={data} />
          <CommissionList summary={data} />
        </>
      )}
    </div>
  );
}
