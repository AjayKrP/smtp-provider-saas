import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { AuthCard } from '../components/AuthCard.js';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { authenticated, logout } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      // Every session was signed out server-side; drop this tab's one too.
      if (authenticated) await logout();
      nav('/login?reset=1', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <h1>Invalid reset link</h1>
        <p className="sub">This link is missing its token. Request a new one to continue.</p>
        <Link to="/forgot-password" className="btn primary block" style={{ marginTop: 20 }}>
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form onSubmit={submit}>
        <h1>Choose a new password</h1>
        <p className="sub">This will sign you out on every device.</p>
        <label htmlFor="password">
          New password <span className="hint">· at least 10 characters</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={10}
          required
          autoFocus
        />
        <label htmlFor="confirm">Confirm new password</label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={10}
          required
        />
        {error && (
          <div className="error">
            {error}{' '}
            {/expired|invalid/i.test(error) && (
              <Link to="/forgot-password">Request a new link</Link>
            )}
          </div>
        )}
        <button className="primary block" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthCard>
  );
}
