import { Link } from 'react-router-dom';
import { useUsage, useDomains, useCredentials } from '../api/hooks.js';
import { StatusBadge } from '../components/bits.js';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function Home() {
  const usage = useUsage();
  const domains = useDomains();
  const creds = useCredentials();

  const u = usage.data;
  const verified = domains.data?.filter((d) => d.status === 'verified').length ?? 0;

  return (
    <>
      <h1>Overview</h1>

      {u && !u.subscriptionActive && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          Your subscription is not active. <Link to="/billing">Update billing</Link> to keep sending.
        </div>
      )}

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label={`Accepted (${u?.period ?? ''})`} value={u ? u.accepted.toLocaleString() : '—'} />
        <Stat label="Monthly quota" value={u ? u.monthlyEmailQuota.toLocaleString() : '—'} />
        <Stat label="Delivered" value={u ? u.delivered.toLocaleString() : '—'} />
        <Stat label="Bounced" value={u ? u.bounced.toLocaleString() : '—'} />
      </div>

      <div className="card">
        <h2>Plan</h2>
        <p>
          {u?.planName ?? '—'} <StatusBadge status={u?.subscriptionActive ? 'active' : 'inactive'} />
        </p>
        <p className="muted">
          {u ? `${u.remaining.toLocaleString()} sends remaining this month` : ''}
        </p>
      </div>

      <div className="card">
        <h2>Getting started</h2>
        <ol className="muted" style={{ lineHeight: 1.9 }}>
          <li>
            {verified > 0 ? '✅ ' : ''}
            <Link to="/domains">Add and verify a sending domain</Link> ({verified} verified)
          </li>
          <li>
            {(creds.data?.length ?? 0) > 0 ? '✅ ' : ''}
            <Link to="/credentials">Create SMTP credentials</Link> ({creds.data?.length ?? 0})
          </li>
          <li>Point your app&apos;s SMTP settings at the host shown on the credentials page</li>
          <li>
            Watch delivery in <Link to="/activity">Activity</Link>
          </li>
        </ol>
      </div>
    </>
  );
}
