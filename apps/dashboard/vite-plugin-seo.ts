import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { SEO_ROUTES, SITE_URL, sitemapRoutes, type SeoRoute } from './src/seo/routes';

/**
 * The app is client-rendered, so the HTML a crawler or a social-media scraper receives is
 * an empty <div> with one <script>. Google renders JavaScript eventually; Slack, X,
 * WhatsApp and LinkedIn never do, and a brand-new domain cannot afford to wait for the
 * render queue.
 *
 * So after the bundle is written, emit one static HTML file per public route — same app,
 * same bundle, but with that route's title, description, canonical, Open Graph tags and
 * JSON-LD already in the markup. nginx serves `/pricing` from `pricing.html`
 * (try_files $uri $uri.html …) with no redirect, and React takes over as usual.
 *
 * Also emits sitemap.xml from the same source, so it can never list a stale route.
 */
const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headFor(route: SeoRoute): string {
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
    // </script> inside JSON would close the tag early; nothing else needs escaping.
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
    );
  }
  return tags.map((t) => `    ${t}`).join('\n');
}

/** Replace the template's own title/description/OG tags with this route's. */
function render(template: string, route: SeoRoute): string {
  const stripped = template
    .replace(/^[ \t]*<title>[\s\S]*?<\/title>\r?\n?/gim, '')
    .replace(/^[ \t]*<meta\s+name="description"[^>]*>\r?\n?/gim, '')
    .replace(/^[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\r?\n?/gim, '');
  return stripped.replace(/([ \t]*)<\/head>/i, `${headFor(route)}\n$1</head>`);
}

function sitemap(): string {
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

export function seoPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'email4vibecoder-seo',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = join(config.root, config.build.outDir);
      const indexPath = join(outDir, 'index.html');
      const template = readFileSync(indexPath, 'utf8');

      for (const route of SEO_ROUTES) {
        // "/" overwrites index.html, which is also the SPA fallback for unknown paths.
        const file =
          route.path === '/' ? indexPath : join(outDir, `${route.path.replace(/^\//, '')}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, render(template, route));
      }
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap());
      config.logger.info(
        `  seo: ${SEO_ROUTES.length} route pages + sitemap.xml (${sitemapRoutes().length} indexable)`,
      );
    },
  };
}
