import { useState } from 'react';
import {
  useCreateCredential,
  useCredentials,
  useDeleteCredential,
  type CreatedCredential,
} from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { CopyButton, Empty, Icon, PageHeader, when } from '../components/bits.js';

function Field({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <tr>
      <th style={{ width: 120 }}>{label}</th>
      <td>
        <div className="copy-field">
          <code style={secret ? { color: 'var(--accent)' } : undefined}>{value}</code>
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        </div>
      </td>
    </tr>
  );
}

function NewCredentialPanel({ cred, onClose }: { cred: CreatedCredential; onClose: () => void }) {
  return (
    <div
      className="card flush"
      style={{ borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' }}
    >
      <div className="card-head">
        <div>
          <h2>Credentials for “{cred.label}”</h2>
          <p>Copy the password now — it is shown only once and cannot be retrieved later.</p>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 16, borderTop: '1px solid var(--border)' }}>
        <table>
          <tbody>
            <Field label="Host" value={cred.smtp.host} />
            <Field label="Port" value={`${cred.smtp.ports.starttls}`} />
            <Field label="Port (TLS)" value={`${cred.smtp.ports.tls}`} />
            <Field label="Username" value={cred.smtp.username} />
            <Field label="Password" value={cred.smtp.password} secret />
          </tbody>
        </table>
      </div>
      <div
        className="row"
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel-2)',
        }}
      >
        <span className="muted small" style={{ flex: 1 }}>
          Use STARTTLS on {cred.smtp.ports.starttls}, or implicit TLS on {cred.smtp.ports.tls}.
        </span>
        <button className="primary sm" onClick={onClose}>
          I’ve saved it
        </button>
      </div>
    </div>
  );
}

export function Credentials() {
  const { data, isLoading } = useCredentials();
  const create = useCreateCredential();
  const del = useDeleteCredential();
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<CreatedCredential | null>(null);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await create.mutateAsync(label.trim());
      setCreated(res);
      setLabel('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="SMTP credentials"
        description="Create a separate login for each app or environment so you can revoke them independently."
      />

      {created && <NewCredentialPanel cred={created} onClose={() => setCreated(null)} />}

      <form className="card" onSubmit={submit}>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Label, e.g. production-app"
            aria-label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <button className="primary" disabled={create.isPending}>
            <Icon name="plus" size={15} />
            {create.isPending ? 'Creating…' : 'Create credentials'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      <div className="card flush">
        {isLoading && (
          <p className="muted" style={{ padding: 20 }}>
            Loading…
          </p>
        )}
        {data?.length === 0 ? (
          <Empty icon="key" title="No credentials yet">
            Create one above to start sending over SMTP.
          </Empty>
        ) : (
          data && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Username</th>
                    <th>Last used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.label}</td>
                      <td>
                        <div className="copy-field">
                          <code>{c.username}</code>
                          <CopyButton value={c.username} label="Copy username" />
                        </div>
                      </td>
                      <td className="muted">{c.lastUsedAt ? when(c.lastUsedAt) : 'Never'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="sm danger"
                          onClick={() => {
                            if (confirm(`Revoke ${c.username}? Apps using it will stop sending.`))
                              del.mutate(c.id);
                          }}
                        >
                          Revoke
                        </button>
                      </td>
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
