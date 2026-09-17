/**
 * Cookie consent for the Google Ads tag.
 *
 * The tag is not in index.html: under the GDPR a non-essential cookie may only be set
 * after the visitor agrees, so nothing from Google is loaded until consent is granted.
 * The session cookie and the sign-in token are strictly necessary and need no consent.
 */
export type Consent = 'granted' | 'denied';

const KEY = 'e4vc_cookie_consent';
const ADS_ID = 'AW-11445809191';
export const CONSENT_CHANGED = 'e4vc:consent-changed';
export const OPEN_CONSENT = 'e4vc:open-consent';

/** localStorage throws in some privacy modes; a missing choice just means "ask again". */
export function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function storeConsent(value: Consent): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Choice will not persist, but it still applies for this page view.
  }
  if (value === 'granted') loadGoogleTag();
  else clearAdCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED, { detail: value }));
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

/** Inject gtag.js and configure it. Idempotent: safe to call on every page view. */
export function loadGoogleTag(): void {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', ADS_ID);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
  document.head.appendChild(script);
}

/**
 * Google's conversion-linker cookie is first-party, so declining is only honest if we
 * also remove what an earlier visit may have set.
 */
function clearAdCookies(): void {
  if (typeof document === 'undefined') return;
  const names = document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0] ?? '')
    .filter((name) => name.startsWith('_gcl') || name.startsWith('_ga'));
  for (const name of names) {
    for (const domain of ['', `; domain=.${location.hostname}`]) {
      document.cookie = `${name}=; max-age=0; path=/${domain}`;
    }
  }
}

/** Call once on start-up: re-arms the tag for visitors who already agreed. */
export function applyStoredConsent(): void {
  if (readConsent() === 'granted') loadGoogleTag();
}
