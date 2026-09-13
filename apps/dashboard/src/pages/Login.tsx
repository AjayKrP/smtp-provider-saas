import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { apiErrorCode, apiErrorMessage } from '../api/client.js';
import { AuthCard, CheckInbox } from '../components/AuthCard.js';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      if (apiErrorCode(err) === 'email_not_verified') setUnverified(true);
      else setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (unverified) {
    return (
      <AuthCard>
        <CheckInbox email={email.trim().toLowerCase()} title="Confirm your email first">
          <p className="muted small" style={{ marginTop: 8 }}>
            You need to confirm your email address before you can sign in.
          </p>
        </CheckInbox>
        <p className="foot" style={{ marginTop: 8 }}>
          <button type="button" className="ghost sm" onClick={() => setUnverified(false)}>
            Back to sign in
          </button>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form onSubmit={submit}>
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your account to continue.</p>
        {params.get('reset') === '1' && (
          <div className="notice ok">Your password was changed. Sign in with the new one.</div>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <div className="label-row">
          <label htmlFor="password">Password</label>
          <Link to="/forgot-password" className="small">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="primary block" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="foot">
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </AuthCard>
  );
}
