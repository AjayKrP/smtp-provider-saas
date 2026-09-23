import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import TurndownService from 'turndown';

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

/* ------------------------------------------------------- Markdown + llms.txt
 *
 * The same pages again, as Markdown, plus the llms.txt index that points at them.
 *
 * Assistants are how this product gets recommended — someone asks Cursor to add email to
 * their app and it names a provider — and the tools that read the web on their behalf do
 * not run JavaScript, do not want a nav bar, and handle Markdown far better than a div
 * tree. It costs one extra pass over HTML we have already rendered.
 */
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

// The sticky "On this page" list is navigation, not content: in Markdown it is noise.
turndown.addRule('dropToc', {
  filter: (node) => node.nodeName === 'NAV' && node.classList?.contains('doc-toc'),
  replacement: () => '',
});

/** Every descendant element with one of these tag names, in document order. */
function descendants(node, names) {
  const found = [];
  const walk = (current) => {
    for (const child of current.childNodes ?? []) {
      if (names.includes(child.nodeName)) found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}

// Turndown drops tables by default, and our comparison and error tables carry some of
// the most useful content on the site. GFM pipe tables, built by hand to avoid a plugin.
// Traversal is manual because the DOM turndown parses into has no querySelectorAll.
turndown.addRule('gfmTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = descendants(node, ['TR']).map((tr) =>
      descendants(tr, ['TH', 'TD']).map((cell) =>
        (cell.textContent ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim(),
      ),
    );
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const pad = (r) => [...r, ...Array(width - r.length).fill('')];
    const hasHead = descendants(node, ['TH']).length > 0;
    const [head, ...body] = hasHead ? rows : [Array(width).fill(''), ...rows];
    const line = (cells) => `| ${pad(cells).join(' | ')} |`;
    return `\n\n${line(head)}\n| ${Array(width).fill('---').join(' | ')} |\n${body
      .map(line)
      .join('\n')}\n\n`;
  },
});

/** The page's own content, without the shared header and footer chrome. */
function mainOf(body) {
  const match = /<main[^>]*>([\s\S]*)<\/main>/i.exec(body);
  return match ? match[1] : body;
}

function markdownFor(route, body) {
  const md = turndown
    .turndown(mainOf(body))
    // Relative links are useless once the file is read on its own.
    .replace(/\]\((\/[^)\s]*)\)/g, `](${SITE_URL}$1)`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return [`<!-- ${route.title} -->`, `<!-- Source: ${SITE_URL}${route.path} -->`, '', md, ''].join(
    '\n',
  );
}

/** llms.txt, per the llmstxt.org convention: a titled index of the Markdown pages. */
function llmsIndex(entries) {
  const group = (heading, paths) => {
    const rows = entries
      .filter((e) => paths.some((p) => e.route.path === p || e.route.path.startsWith(p)))
      .map(
        (e) =>
          `- [${e.route.title.split(' — ')[0]}](${SITE_URL}${e.mdPath}): ${e.route.description}`,
      );
    return rows.length ? `## ${heading}\n\n${rows.join('\n')}\n` : '';
  };

  const head = [
    '# Email4VibeCoder',
    '',
    '> Transactional email over plain SMTP for developers and AI-built apps. Ports 587 and',
    '> 465, DKIM signing, per-message delivery logs, and prepaid monthly plans billed in INR',
    '> (UPI, cards, netbanking) with no auto-renewal. 500 emails a month free, no card.',
    '',
    'There is no send API and no SDK: an app points its existing SMTP settings at',
    'smtp.email4vibecoder.com. Mail may only be sent from a domain the account has verified,',
    'which is what allows it to be DKIM-signed. Bulk and marketing email are not permitted.',
    '',
  ];
  const sections = [
    group('Setup', ['/docs', '/prompt']),
    group('Guides', ['/guides']),
    group('Comparisons', ['/compare']),
    group('Service', ['/pricing', '/terms', '/privacy']),
  ].filter(Boolean);

  return [...head, ...sections].join('\n');
}

function writeMarkdownMirror(bodies) {
  const entries = [];
  for (const route of sitemapRoutes()) {
    const body = bodies.get(route.path);
    if (!body) continue;
    const mdPath = route.path === '/' ? '/index.md' : `${route.path}.md`;
    const file = join(dist, mdPath.replace(/^\//, ''));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, markdownFor(route, body));
    entries.push({ route, mdPath });
  }
  writeFileSync(join(dist, 'llms.txt'), `${llmsIndex(entries)}\n`);
  // llms-full.txt: the whole site as one document, for tools that would rather take it
  // in a single fetch than crawl. Small enough to stay a single file for a long time.
  const full = entries
    .map(
      (e) =>
        `# ${e.route.title}\n<!-- ${SITE_URL}${e.route.path} -->\n\n${turndown
          .turndown(mainOf(bodies.get(e.route.path)))
          .replace(/\n{3,}/g, '\n\n')
          .trim()}`,
    )
    .join('\n\n---\n\n');
  writeFileSync(join(dist, 'llms-full.txt'), `${full}\n`);
  return entries.length;
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
/** Rendered body per indexable route, reused by the Markdown mirror below. */
const rendered = new Map();
for (const route of SEO_ROUTES) {
  const body = render(route.path);
  if (!/<h1[\s>]/i.test(body)) noHeading.push(route.path);
  if (route.priority) rendered.set(route.path, body);
  const html = applyHead(template, route).replace(ROOT, `<div id="root">${body}</div>`);
  const file = route.path === '/' ? indexPath : join(dist, `${route.path.replace(/^\//, '')}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
writeFileSync(join(dist, 'sitemap.xml'), sitemap());
const markdownFiles = writeMarkdownMirror(rendered);
rmSync(ssrDir, { recursive: true, force: true });

// Every page needs exactly one top-level heading: it is both an SEO signal and a
// screen-reader landmark, and its absence usually means the route rendered nothing.
if (noHeading.length > 0) {
  console.error(`prerender: no <h1> on ${noHeading.join(', ')}`);
  process.exit(1);
}
console.log(
  `prerender: ${SEO_ROUTES.length} pages with content + sitemap.xml (${sitemapRoutes().length} indexable)` +
    `, ${markdownFiles} markdown files + llms.txt`,
);
