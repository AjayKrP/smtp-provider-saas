import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  OPEN_CONSENT,
  applyStoredConsent,
  readConsent,
  storeConsent,
  type Consent,
} from '../consent.js';

/**
 * Consent banner for the Google Ads tag.
 *
 * Accept and Reject are given equal weight: the GDPR requires refusing to be as easy as
 * agreeing, so this is deliberately not a single "OK" button with a buried opt-out.
 * Nothing renders until after mount, since the choice lives in localStorage and the
 * prerendered HTML must not assume one.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applyStoredConsent();
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (value: Consent) => () => {
    storeConsent(value);
    setOpen(false);
  };

  return (
    <div className="consent" role="dialog" aria-modal="false" aria-label="Cookie choices">
      <div className="consent-inner">
        <p>
          We use cookies that are needed to sign you in, and — only if you agree — a Google
          advertising cookie that tells us which adverts bring people here. See our{' '}
          <Link to="/privacy#cookies">Privacy Policy</Link>.
        </p>
        <div className="row consent-actions">
          <button type="button" onClick={choose('denied')}>
            Reject
          </button>
          <button type="button" className="primary" onClick={choose('granted')}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
