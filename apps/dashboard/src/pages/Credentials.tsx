import { useState } from 'react';
import {
  useCreateCredential,
  useCredentials,
  useDeleteCredential,
  type CreatedCredential,
} from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { when } from '../components/bits.js';

function NewCredentialPanel({ cred, onClose }: { cred: CreatedCredential; onClose: () => void }) {
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <h2>SMTP credentials for “{cred.label}”</h2>
      <p className="error">
        Copy the password now — it is shown only once and cannot be retrieved later.
      </p>
      <pre>
{`Host:      ${cred.smtp.host}
Port:      ${cred.smtp.ports.starttls}  (STARTTLS)  or  ${cred.smtp.ports.tls}  (TLS)
Username:  ${cred.smtp.username}
Password:  ${cred.smtp.password}`}
      </pre>
      <button className="primary" onClick={onClose}>
        Done
      </button>
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
      <h1>SMTP credentials</h1>

      {created && <NewCredentialPanel cred={created} onClose={() => setCreated(null)} />}

      <form className="card" onSubmit={submit}>
        <h2>Create credentials</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Label</label>
            <input
              placeholder="production-app"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <button className="primary" disabled={create.isPending}>
            Create
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      <div className="card">
        {isLoading && <p className="muted">Loading…</p>}
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
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td>
                  <code>{c.username}</code>
                </td>
                <td className="muted">{when(c.lastUsedAt)}</td>
                <td>
                  <button
                    onClick={() => {
                      if (confirm(`Revoke ${c.username}?`)) del.mutate(c.id);
                    }}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No credentials yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
