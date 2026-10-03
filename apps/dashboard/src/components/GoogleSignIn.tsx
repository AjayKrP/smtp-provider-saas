import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { usePublicConfig } from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { clearReferralCode, readReferralCode } from '../referral.js';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'small' | 'medium' | 'large';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      width?: number;
      logo_alignment?: 'left' | 'center';
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

/** Load Google's script once per page, no matter how many buttons ask for it. */
let scriptPromise: Promise<void> | undefined;
function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * "Continue with Google", rendered by Google's own library.
 *
 * Renders nothing at all when the server has no client id configured, so the feature is
 * absent rather than broken — and nothing is requested from Google on a page where it
 * cannot work. The button markup comes from Google rather than being styled by us: it is
 * an iframe they control, which is also why its look cannot follow our theme.
 */
export function GoogleSignIn({
  text = 'continue_with',
  placement = 'above',
}: {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  /**
   * Where this sits relative to the email form. It only moves the "or" divider, which
   * belongs between the two choices — so it follows the button when the button is first,
   * and precedes it when the form is.
   */
  placement?: 'above' | 'below';
}) {
  const clientId = usePublicConfig().data?.googleClientId;
  const { signInWithGoogle } = useAuth();
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const api = window.google?.accounts.id;
        if (cancelled || !api || !holder.current) return;
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              setError('Google did not return a sign-in token. Please try again.');
              return;
            }
            setBusy(true);
            setError('');
            // The referral code, if this visitor arrived through someone's link: a
            // Google signup should earn a referrer exactly as a form signup does.
            signInWithGoogle(response.credential, readReferralCode())
              .then(() => clearReferralCode())
              .catch((err: unknown) => setError(apiErrorMessage(err)))
              .finally(() => setBusy(false));
          },
          // One-tap auto sign-in is deliberately off: it signs people in before they
          // have decided to, which is startling on a page they arrived at to read.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        api.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Google sign-in. Use your email and password.');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, signInWithGoogle, text]);

  if (!clientId) return null;

  const divider = (
    <div className="divider">
      <span>or</span>
    </div>
  );

  return (
    <div className={`google-signin ${placement}`}>
      {placement === 'below' && divider}
      <div ref={holder} className="google-button" aria-busy={busy} />
      {busy && <p className="muted small">Signing you in…</p>}
      {error && <p className="error">{error}</p>}
      {placement === 'above' && divider}
    </div>
  );
}
