import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { AuthCard } from '../components/AuthCard.js';
import { PENDING_PLAN_KEY } from './Register.js';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { startSession } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState(token ? '' : 'This verification link is missing its token.');
  // Tokens are single-use: guard against React StrictMode running the effect twice.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post<{ accessToken: string }>('/auth/verify-email', { token })
      .then(({ data }) => {
        let plan: string | null = null;
        try {
          plan = localStorage.getItem(PENDING_PLAN_KEY);
          localStorage.removeItem(PENDING_PLAN_KEY);
        } catch {
          // Storage unavailable.
        }
        startSession(data.accessToken);
        nav(plan ? `/billing?plan=${encodeURIComponent(plan)}` : '/', { replace: true });
      })
      .catch((err: unknown) => setError(apiErrorMessage(err)));
  }, [token, startSession, nav]);

  if (!error) {
    return (
      <AuthCard>
        <h1>Confirming your email…</h1>
        <p className="sub">One moment.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1>Link not valid</h1>
      <p className="sub">{error}</p>
      <p className="muted small" style={{ marginTop: 8 }}>
        Verification links expire after 24 hours and work once. Sign in to get a new one — if your
        email is already confirmed, you&apos;ll go straight in.
      </p>
      <Link to="/login" className="btn primary block" style={{ marginTop: 20 }}>
        Go to sign in
      </Link>
    </AuthCard>
  );
}
