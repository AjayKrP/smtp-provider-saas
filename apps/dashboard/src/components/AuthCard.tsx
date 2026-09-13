import { useState, type ReactNode } from 'react';
import { api, apiErrorMessage } from '../api/client.js';
import { Icon, Logo } from './bits.js';

/** Centered logo + card shell shared by every signed-out auth page. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <Logo />
      <div className="card authbox">{children}</div>
    </div>
  );
}

/** "Check your inbox" state with a throttled resend button. */
export function CheckInbox({
  email,
  title = 'Check your inbox',
  children,
}: {
  email: string;
  title?: string;
  children?: ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function resend() {
    setState('sending');
    setError('');
    try {
      await api.post('/auth/resend-verification', { email });
      setState('sent');
    } catch (err) {
      setError(apiErrorMessage(err));
      setState('idle');
    }
  }

  return (
    <>
      <div className="auth-icon">
        <Icon name="mail" size={22} />
      </div>
      <h1>{title}</h1>
      <p className="sub">
        We sent a verification link to <strong>{email}</strong>. Open it to activate your account —
        the link is valid for 24 hours.
      </p>
      {children}
      {error && <div className="error">{error}</div>}
      <button
        type="button"
        className="block"
        style={{ marginTop: 20 }}
        onClick={resend}
        disabled={state !== 'idle'}
      >
        {state === 'sending'
          ? 'Sending…'
          : state === 'sent'
            ? 'Email sent — check your inbox'
            : 'Resend email'}
      </button>
      <p className="foot">Can&apos;t find it? Check your spam folder.</p>
    </>
  );
}
