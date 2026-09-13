import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { apiErrorMessage } from '../api/client.js';
import { AuthCard, CheckInbox } from '../components/AuthCard.js';

/** Remembered across the round trip through the verification email (often a new tab). */
export const PENDING_PLAN_KEY = 'smtp_saas_pending_plan';

export function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.organizationName || undefined,
      });
      try {
        if (plan) localStorage.setItem(PENDING_PLAN_KEY, plan);
      } catch {
        // Storage unavailable; the user just lands on the overview after verifying.
      }
      setRegisteredEmail(form.email.trim().toLowerCase());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (registeredEmail) {
    return (
      <AuthCard>
        <CheckInbox email={registeredEmail} title="Confirm your email" />
        <p className="foot" style={{ marginTop: 8 }}>
          Already confirmed? <Link to="/login">Sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <form onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="sub">Free to start. No credit card required.</p>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          autoComplete="name"
          value={form.name}
          onChange={set('name')}
          required
          autoFocus
        />
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={set('email')}
          required
        />
        <label htmlFor="password">
          Password <span className="hint">· at least 10 characters</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          minLength={10}
          required
        />
        <label htmlFor="org">
          Organization <span className="hint">· optional</span>
        </label>
        <input id="org" value={form.organizationName} onChange={set('organizationName')} />
        {error && <div className="error">{error}</div>}
        <button className="primary block" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
