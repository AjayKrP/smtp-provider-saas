import { useState, type ReactNode } from 'react';
import { api, apiErrorMessage } from '../api/client.js';
import { usePublicConfig } from '../api/hooks.js';
import { Icon } from './bits.js';

/** Centered card for auth pages; the site header and footer come from PublicLayout. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
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
  // The address the mail is actually sent From, so searching for it finds the message.
  const senderAddress = usePublicConfig().data?.supportEmail ?? 'hello@email4vibecoder.com';

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

      {/*
        Prominent rather than a footnote under the button: login requires a verified
        address, so a verification email sitting in spam is a signup that dies silently.
        The "mark it as not spam" ask is not politeness — recipient engagement is the
        strongest short-term signal a young sending domain has, so a reader who moves it
        to their inbox measurably helps the next person's email arrive.
      */}
      <div className="banner spam-hint">
        <div>
          <strong>Not in your inbox?</strong> Check your spam or junk folder and search for{' '}
          <code>{senderAddress}</code>. If you find it there, please mark it{' '}
          <strong>Not spam</strong> — that helps the next email reach you properly.
        </div>
      </div>

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
            ? 'Email sent — check your inbox and spam folder'
            : 'Resend email'}
      </button>
    </>
  );
}
