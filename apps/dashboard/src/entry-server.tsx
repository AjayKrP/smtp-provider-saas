import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.js';
import { App } from './App.js';

/** Re-exported so the prerender script has a single source for route metadata. */
export { SEO_ROUTES, SITE_URL, sitemapRoutes, type SeoRoute } from './seo/routes.js';

/**
 * Render one public route to HTML at build time (see scripts/prerender.mjs).
 *
 * Queries are disabled rather than awaited: the build has no API to call, and baking a
 * snapshot of live prices or plan names into static HTML would go stale. Components fall
 * back to their loading state, so what gets prerendered is the durable content search
 * engines care about — headings, copy, links and the FAQ.
 */
export function render(path: string): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={path}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StaticRouter>
    </QueryClientProvider>,
  );
}
