import { useState } from 'react';
import {
  useAddDomain,
  useDomains,
  useVerifyDomain,
  useDeleteDomain,
  type Domain,
} from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { StatusBadge, when } from '../components/bits.js';

function DnsTable({ domain }: { domain: Domain }) {
  return (
    <table style={{ marginTop: 10 }}>
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
            <td>{r.type}</td>
            <td>
              <code>{r.host}</code>
            </td>
            <td style={{ maxWidth: 380, wordBreak: 'break-all' }}>
              <code>{r.value}</code>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {r.purpose}
              </div>
            </td>
            <td>{r.required ? <span className="badge warn">required</span> : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DomainCard({ domain }: { domain: Domain }) {
  const verify = useVerifyDomain();
  const del = useDeleteDomain();
  const [msg, setMsg] = useState('');

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{domain.domain}</strong>
        <StatusBadge status={domain.status} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        DKIM {domain.dkimVerified ? '✓' : '✗'} · SPF {domain.spfVerified ? '✓' : '✗'} · last checked{' '}
        {when(domain.lastCheckedAt)}
      </p>
      <DnsTable domain={domain} />
      {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
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
          {verify.isPending ? 'Checking…' : 'Verify DNS'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Remove ${domain.domain}?`)) del.mutate(domain.id);
          }}
        >
          Remove
        </button>
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
      <h1>Sending domains</h1>
      <form className="card" onSubmit={submit}>
        <h2>Add a domain</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Domain</label>
            <input
              placeholder="mail.yourcompany.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <button className="primary" disabled={add.isPending}>
            Add
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {isLoading && <p className="muted">Loading…</p>}
      {data?.length === 0 && <p className="muted">No domains yet.</p>}
      {data?.map((d) => <DomainCard key={d.id} domain={d} />)}
    </>
  );
}
