import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Turn the client-rendered bundle into real HTML pages, one per public route.
 *
 * Without this, every crawler and link preview receives `<div id="root"></div>`: no H1,
 * no copy, no internal links, and one shared title. Google renders JavaScript eventually,
 * but audit tools, social scrapers and AI crawlers do not, and a new domain cannot afford
 * to wait for the render queue.
 *
 * Runs after `vite build` (client) and `vite build --ssr` (server bundle):
 *   dist/index.html      -> the "/" route, and the SPA fallback for everything else
 *   dist/pricing.html    -> served by nginx for /pricing via try_files $uri.html
 *   dist/sitemap.xml
 *
 * React re-renders on load, so a stale prerender can never be shown to a real visitor.
 */
const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const dist = join(appDir, 'dist');
const ssrDir = join(appDir, 'dist-ssr');

const { SEO_ROUTES, SITE_URL, sitemapRoutes, render } = await import(
  pathToFileURL(join(ssrDir, 'entry-server.js')).href
);

const escapeAttr = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headFor(route) {
  const url = `${SITE_URL}${route.path}`;
  const tags = [
    `<title>${escapeAttr(route.title)}</title>`,
    `<meta name="description" content="${escapeAttr(route.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta name="robots" content="${route.priority ? 'index, follow' : 'noindex, follow'}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Email4VibeCoder" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:title" content="${escapeAttr(route.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(route.description)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeAttr(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(route.description)}" />`,
  ];
  if (route.jsonLd?.length) {
    const graph = { '@context': 'https://schema.org', '@graph': route.jsonLd };
    // A literal "</script>" inside the JSON would close the tag early.
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
    );
  }
  return tags.map((t) => `    ${t}`).join('\n');
}

/** Swap the template's own title/description/OG tags for this route's. */
function applyHead(template, route) {
  const stripped = template
    .replace(/^[ \t]*<title>[\s\S]*?<\/title>\r?\n?/gim, '')
    .replace(/^[ \t]*<meta\s+name="description"[^>]*>\r?\n?/gim, '')
    .replace(/^[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\r?\n?/gim, '');
  return stripped.replace(/([ \t]*)<\/head>/i, `${headFor(route)}\n$1</head>`);
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = sitemapRoutes()
    .map((r) =>
      [
        '  <url>',
        `    <loc>${SITE_URL}${r.path}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${r.changefreq ?? 'monthly'}</changefreq>`,
        `    <priority>${r.priority}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const indexPath = join(dist, 'index.html');
const template = readFileSync(indexPath, 'utf8');
const ROOT = '<div id="root"></div>';
if (!template.includes(ROOT)) {
  // Already prerendered (or the shell changed): index.html is rewritten in place, so this
  // script is only valid directly after `vite build`. `npm run build` does both in order.
  throw new Error(
    'dist/index.html is not a fresh Vite shell — run `npm run build`, not this script alone',
  );
}

const noHeading = [];
for (const route of SEO_ROUTES) {
  const body = render(route.path);
  if (!/<h1[\s>]/i.test(body)) noHeading.push(route.path);
  const html = applyHead(template, route).replace(ROOT, `<div id="root">${body}</div>`);
  const file = route.path === '/' ? indexPath : join(dist, `${route.path.replace(/^\//, '')}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
writeFileSync(join(dist, 'sitemap.xml'), sitemap());
rmSync(ssrDir, { recursive: true, force: true });

// Every page needs exactly one top-level heading: it is both an SEO signal and a
// screen-reader landmark, and its absence usually means the route rendered nothing.
if (noHeading.length > 0) {
  console.error(`prerender: no <h1> on ${noHeading.join(', ')}`);
  process.exit(1);
}
console.log(
  `prerender: ${SEO_ROUTES.length} pages with content + sitemap.xml (${sitemapRoutes().length} indexable)`,
);
