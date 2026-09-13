import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client.js';
import { AuthCard } from '../components/AuthCard.js';
import { Icon } from '../components/bits.js';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard>
        <div className="auth-icon">
          <Icon name="mail" size={22} />
        </div>
        <h1>Check your inbox</h1>
        <p className="sub">
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve emailed a link to reset
          your password. It&apos;s valid for 1 hour.
        </p>
        <p className="foot">
          <Link to="/login">Back to sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form onSubmit={submit}>
        <h1>Forgot your password?</h1>
        <p className="sub">Enter your email and we&apos;ll send you a link to choose a new one.</p>
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
        {error && <div className="error">{error}</div>}
        <button className="primary block" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <p className="foot">
          Remembered it? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
