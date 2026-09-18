import { Navigate } from 'react-router-dom';
import { useAdminStats, useMe } from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { Empty, PageHeader, StatusBadge, day, money, when } from '../components/bits.js';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());

export function Admin() {
  const me = useMe();
  const isAdmin = me.data?.isAdmin === true;
  const stats = useAdminStats();

  if (me.data && !isAdmin) return <Navigate to="/" replace />;
  const s = stats.data;

  return (
    <>
      <PageHeader title="Admin" description="Signups and purchases across every account." />

      {stats.error && <p className="error">{apiErrorMessage(stats.error)}</p>}

      <div className="grid" style={{ marginBottom: 16 }}>
        <Stat label="Registered users" value={fmt(s?.users.total)} />
        <Stat label="Verified" value={fmt(s?.users.verified)} />
        <Stat label="New in 7 days" value={fmt(s?.users.last7Days)} />
        <Stat label="New in 30 days" value={fmt(s?.users.last30Days)} />
        <Stat label="Active paid plans" value={fmt(s?.activePaidSubscriptions)} />
        <Stat
          label="Revenue"
          value={
            s
              ? s.revenue.length
                ? s.revenue.map((r) => money(r.amount, r.currency)).join(' + ')
                : '—'
              : '—'
          }
        />
      </div>

      <div className="card flush" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Recent signups</h2>
        </div>
        {stats.isLoading && (
          <p className="muted" style={{ padding: 20 }}>
            Loading…
          </p>
        )}
        {s?.recentUsers.length === 0 ? (
          <Empty icon="inbox" title="No users yet" />
        ) : (
          s && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Signed up</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Workspace</th>
                    <th>Plan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {when(u.createdAt)}
                      </td>
                      <td className="truncate">{u.name}</td>
                      <td className="truncate">{u.email}</td>
                      <td className="truncate muted">{u.organizationName ?? '—'}</td>
                      <td>{u.planKey ?? '—'}</td>
                      <td>
                        <StatusBadge status={u.verified ? 'verified' : 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <div className="card flush">
        <div className="card-head">
          <h2>Recent purchases</h2>
        </div>
        {s?.recentPayments.length === 0 ? (
          <Empty icon="wallet" title="No purchases yet" />
        ) : (
          s && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Paid</th>
                    <th>Email</th>
                    <th>Workspace</th>
                    <th>Plan</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {day(p.paidAt)}
                      </td>
                      <td className="truncate">{p.email ?? '—'}</td>
                      <td className="truncate muted">{p.organizationName ?? '—'}</td>
                      <td>{p.planKey}</td>
                      <td className="num">{money(p.amount, p.currency, { exact: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}
