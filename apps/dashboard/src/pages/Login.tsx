import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { apiErrorMessage } from '../api/client.js';
import { Logo } from '../components/bits.js';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Logo />
      <form className="card authbox" onSubmit={submit}>
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your account to continue.</p>
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
        <label htmlFor="password">Password</label>
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
    </div>
  );
}
