import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_ROUTES, SITE_URL, seoRouteFor } from './routes.js';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Keep the document head in step with client-side navigation. The build already bakes
 * these tags into each route's HTML for crawlers that don't run JavaScript; this covers
 * in-app navigation, where no new document is ever fetched.
 *
 * Anything not listed in SEO_ROUTES is a signed-in dashboard page: those are excluded
 * from the sitemap and marked noindex so private views never reach search results.
 */
export function useSeo(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const route = seoRouteFor(pathname);
    const known = SEO_ROUTES.some((r) => r.path === pathname);
    const title = route?.title ?? 'Dashboard — Email4VibeCoder';
    const description = route?.description ?? '';

    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', `${SITE_URL}${pathname}`);
    setMeta('meta[name="robots"]', 'name', 'robots', known ? 'index, follow' : 'noindex, nofollow');
    setCanonical(`${SITE_URL}${route?.path ?? pathname}`);
  }, [pathname]);
}
