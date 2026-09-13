import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useMessages, type MessageSummary } from '../api/hooks.js';
import { Empty, PageHeader, StatusBadge, bytes, when } from '../components/bits.js';

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
    <div style={{ padding: '4px 0' }}>
      <p className="muted small">
        <code>{data.messageId}</code> · envelope-from {data.envelopeFrom}
      </p>
      {data.lastError && <p className="error">{data.lastError}</p>}
      <div className="card flush" style={{ margin: '12px 0 0', boxShadow: 'none' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Recipient</th>
                <th>MX</th>
                <th>SMTP response</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e, i) => (
                <tr key={i}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {when(e.at)}
                  </td>
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
      </div>
    </div>
  );
}

export function Activity() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useMessages(status || undefined);

  return (
    <>
      <PageHeader
        title="Activity"
        description="Recent messages and their delivery status. Click a row for details."
      >
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          style={{ width: 170 }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s[0]!.toUpperCase() + s.slice(1) : 'All statuses'}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="card flush">
        {isLoading && (
          <p className="muted" style={{ padding: 20 }}>
            Loading…
          </p>
        )}
        {data?.items.length === 0 ? (
          <Empty icon="inbox" title="No messages yet">
            {status
              ? `Nothing with status “${status}”.`
              : 'Messages you send over SMTP will appear here.'}
          </Empty>
        ) : (
          data && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>From</th>
                    <th>Subject</th>
                    <th>To</th>
                    <th>Status</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => (
                    <Fragment key={m.id}>
                      <tr
                        className="clickable"
                        onClick={() => setOpen(open === m.id ? null : m.id)}
                      >
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                          {when(m.createdAt)}
                        </td>
                        <td className="truncate">{m.from}</td>
                        <td className="truncate">
                          {m.subject || <span className="muted">(no subject)</span>}
                        </td>
                        <td className="num">{m.to.length}</td>
                        <td>
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="muted num">{bytes(m.sizeBytes)}</td>
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
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}
