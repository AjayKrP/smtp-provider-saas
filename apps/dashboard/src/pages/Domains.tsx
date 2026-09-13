import { useState } from 'react';
import {
  useAddDomain,
  useDomains,
  useVerifyDomain,
  useDeleteDomain,
  type Domain,
} from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { CopyButton, Empty, Icon, PageHeader, StatusBadge, when } from '../components/bits.js';

function DnsTable({ domain }: { domain: Domain }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Host</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {domain.dnsRecords.map((r, i) => (
            <tr key={i}>
              <td>
                <span className="badge plain">{r.type}</span>
              </td>
              <td>
                <div className="copy-field">
                  <code>{r.host}</code>
                  <CopyButton value={r.host} label="Copy host" />
                </div>
              </td>
              <td style={{ maxWidth: 420 }}>
                <div className="copy-field">
                  <code>{r.value}</code>
                  <CopyButton value={r.value} label="Copy value" />
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {r.purpose}
                </div>
              </td>
              <td>{r.required ? <span className="badge warn plain">Required</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`badge ${ok ? 'ok' : 'warn'}`} style={{ textTransform: 'none' }}>
      {label} {ok ? 'verified' : 'pending'}
    </span>
  );
}

function DomainCard({ domain }: { domain: Domain }) {
  const verify = useVerifyDomain();
  const del = useDeleteDomain();
  const [msg, setMsg] = useState('');

  return (
    <div className="card flush">
      <div className="card-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {domain.domain} <StatusBadge status={domain.status} />
          </h2>
          <p>Last checked {when(domain.lastCheckedAt)}</p>
        </div>
        <div className="row">
          <Check ok={domain.dkimVerified} label="DKIM" />
          <Check ok={domain.spfVerified} label="SPF" />
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)' }}>
        <DnsTable domain={domain} />
      </div>
      <div
        className="row"
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel-2)',
        }}
      >
        <button
          className="primary sm"
          disabled={verify.isPending}
          onClick={async () => {
            setMsg('');
            try {
              const res = await verify.mutateAsync(domain.id);
              setMsg(
                Object.entries(res.verification)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · '),
              );
            } catch (err) {
              setMsg(apiErrorMessage(err));
            }
          }}
        >
          <Icon name="refresh" size={14} />
          {verify.isPending ? 'Checking…' : 'Verify DNS'}
        </button>
        <button
          className="sm danger"
          onClick={() => {
            if (confirm(`Remove ${domain.domain}?`)) del.mutate(domain.id);
          }}
        >
          Remove
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </div>
  );
}

export function Domains() {
  const { data, isLoading } = useDomains();
  const add = useAddDomain();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await add.mutateAsync(value.trim().toLowerCase());
      setValue('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Sending domains"
        description="Verify the domains you send from so mail is DKIM-signed and trusted by inboxes."
      />

      <form className="card" onSubmit={submit}>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="yourcompany.com"
            aria-label="Domain"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <button className="primary" disabled={add.isPending}>
            <Icon name="plus" size={15} />
            {add.isPending ? 'Adding…' : 'Add domain'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {isLoading && <p className="muted">Loading…</p>}
      {data?.length === 0 && (
        <div className="card">
          <Empty icon="globe" title="No domains yet">
            Add your first domain above to get DNS records to publish.
          </Empty>
        </div>
      )}
      {data?.map((d) => (
        <DomainCard key={d.id} domain={d} />
      ))}
    </>
  );
}
