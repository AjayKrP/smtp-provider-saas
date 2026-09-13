import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { apiErrorMessage } from '../api/client.js';
import { Logo } from '../components/bits.js';

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      // Came from a paid plan on the pricing page — land on Billing with it highlighted.
      nav(plan ? `/billing?plan=${encodeURIComponent(plan)}` : '/');
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
    </div>
  );
}
