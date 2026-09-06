import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { apiErrorMessage } from '../api/client.js';

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
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
      nav('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card authbox" onSubmit={submit}>
        <h1>Create your account</h1>
        <label>Name</label>
        <input value={form.name} onChange={set('name')} required />
        <label>Work email</label>
        <input type="email" value={form.email} onChange={set('email')} required />
        <label>Password (min 10 characters)</label>
        <input type="password" value={form.password} onChange={set('password')} minLength={10} required />
        <label>Organization name (optional)</label>
        <input value={form.organizationName} onChange={set('organizationName')} />
        {error && <div className="error">{error}</div>}
        <button className="primary" style={{ marginTop: 16, width: '100%' }} disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted" style={{ marginTop: 12 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
