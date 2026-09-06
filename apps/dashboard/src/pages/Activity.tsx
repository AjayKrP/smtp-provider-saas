import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useMessages, type MessageSummary } from '../api/hooks.js';
import { StatusBadge, bytes, when } from '../components/bits.js';

const STATUSES = ['', 'queued', 'sending', 'delivered', 'deferred', 'bounced', 'failed'];

interface MessageDetail extends MessageSummary {
  envelopeFrom: string;
  lastError: string | null;
  events: {
    type: string;
    recipient: string | null;
    mxHost: string | null;
    smtpCode: number | null;
    smtpResponse: string | null;
    at: string;
  }[];
}

function Detail({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ['message', id],
    queryFn: () => api.get<MessageDetail>(`/messages/${id}`).then((r) => r.data),
  });
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div>
      <p className="muted" style={{ fontSize: 12 }}>
        {data.messageId} · envelope-from {data.envelopeFrom}
      </p>
      {data.lastError && <p className="error">{data.lastError}</p>}
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Recipient</th>
            <th>MX</th>
            <th>SMTP</th>
          </tr>
        </thead>
        <tbody>
          {data.events.map((e, i) => (
            <tr key={i}>
              <td className="muted">{when(e.at)}</td>
              <td>
                <StatusBadge status={e.type} />
              </td>
              <td>{e.recipient ?? '—'}</td>
              <td className="muted">{e.mxHost ?? '—'}</td>
              <td className="muted">
                {e.smtpCode ?? ''} {e.smtpResponse ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Activity() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useMessages(status || undefined);

  return (
    <>
      <h1>Activity</h1>
      <div className="card">
        <label>Filter by status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'all'}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {isLoading && <p className="muted">Loading…</p>}
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>From</th>
              <th>Recipients</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((m) => (
              <Fragment key={m.id}>
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => setOpen(open === m.id ? null : m.id)}
                >
                  <td className="muted">{when(m.createdAt)}</td>
                  <td>{m.from}</td>
                  <td>{m.to.length}</td>
                  <td>{m.subject || <span className="muted">(no subject)</span>}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="muted">{bytes(m.sizeBytes)}</td>
                </tr>
                {open === m.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--panel-2)' }}>
                      <Detail id={m.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No messages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
