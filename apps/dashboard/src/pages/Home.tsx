import { Link } from 'react-router-dom';
import { useUsage, useDomains, useCredentials, useMe, useMessages } from '../api/hooks.js';
import { Icon, PageHeader, StatusBadge, when } from '../components/bits.js';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());

export function Home() {
  const me = useMe();
  const usage = useUsage();
  const domains = useDomains();
  const creds = useCredentials();
  const messages = useMessages();

  const u = usage.data;
  const verified = domains.data?.filter((d) => d.status === 'verified').length ?? 0;
  const credCount = creds.data?.length ?? 0;
  const hasSent = (messages.data?.items.length ?? 0) > 0;
  const pct =
    u && u.monthlyEmailQuota > 0 ? Math.min(100, (u.accepted / u.monthlyEmailQuota) * 100) : 0;
  const firstName = me.data?.name?.split(' ')[0];

  const steps = [
    { done: verified > 0, to: '/domains', label: 'Add and verify a sending domain' },
    { done: credCount > 0, to: '/credentials', label: 'Create SMTP credentials' },
    { done: hasSent, to: '/activity', label: 'Send your first email and watch it in Activity' },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Overview'}
        description="Here’s how your sending looks this month."
      />

      {u && !u.subscriptionActive && (
        <div className="banner err">
          <span>Your subscription is not active, so sending is paused.</span>
          <Link to="/billing" className="btn sm">
            Update billing
          </Link>
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div>
            <h2>
              {u?.planName ?? '—'} plan{' '}
              {u && <StatusBadge status={u.subscriptionActive ? 'active' : 'inactive'} />}
            </h2>
            <p>
              {u
                ? `${fmt(u.accepted)} of ${fmt(u.monthlyEmailQuota)} emails used in ${u.period}`
                : 'Loading…'}
            </p>
          </div>
          <Link to="/billing" className="btn sm">
            {u?.planKey === 'free' ? 'Upgrade' : 'Manage plan'}
          </Link>
        </div>
        <div className={`meter${pct >= 95 ? ' err' : pct >= 80 ? ' warn' : ''}`}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="Delivered" value={fmt(u?.delivered)} />
        <Stat label="Bounced" value={fmt(u?.bounced)} />
        <Stat label="Failed" value={fmt(u?.failed)} />
        <Stat label="Remaining" value={fmt(u?.remaining)} />
      </div>

      {hasSent && (
        <div className="card flush">
          <div className="card-head">
            <h2>Recent messages</h2>
            <Link to="/activity" className="btn sm ghost">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
            <table>
              <tbody>
                {messages.data?.items.slice(0, 5).map((m) => (
                  <tr key={m.id}>
                    <td className="truncate" style={{ fontWeight: 500 }}>
                      {m.subject || <span className="muted">(no subject)</span>}
                    </td>
                    <td className="muted truncate">{m.to[0]?.address}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {when(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!allDone && (
        <div className="card">
          <div className="card-head" style={{ marginBottom: 4 }}>
            <div>
              <h2>Get started</h2>
              <p>Three steps to your first delivered email.</p>
            </div>
          </div>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.to} className={s.done ? 'done' : ''}>
                <span className="dot">{s.done ? <Icon name="check" size={13} /> : i + 1}</span>
                <span className="text">{s.label}</span>
                {!s.done && (
                  <Link to={s.to} className="btn sm ghost">
                    Go <Icon name="arrow" size={14} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
