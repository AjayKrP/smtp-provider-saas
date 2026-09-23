import { FAQ } from '../content/faq.js';
import { GUIDES } from '../content/guides.js';

/**
 * Per-route metadata, shared by two consumers so they can never disagree:
 *  - the Vite build bakes each entry into a static HTML file per route, so crawlers and
 *    social scrapers (which do not run JavaScript) get real tags, not an empty <div>;
 *  - useSeo() applies the same values on client-side navigation.
 *
 * Deliberately free of JSX and browser globals: the build imports this in Node.
 */
export const BRAND = 'Email4VibeCoder';

/**
 * Canonical origin. A plain constant on purpose: this module is imported both by the
 * browser bundle (where `process` does not exist) and by the Node build, and a canonical
 * URL should always point at production even when previewed elsewhere.
 */
export const SITE_URL = 'https://email4vibecoder.com';

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  /** Sitemap hints. Omitted for pages we do not want crawled. */
  priority?: string;
  changefreq?: string;
  jsonLd?: unknown[];
}

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BRAND,
  url: SITE_URL,
  email: 'hello@email4vibecoder.com',
  description: `${BRAND} is an SMTP email service for developers and AI-built applications.`,
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: BRAND,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

/**
 * Prices are intentionally absent: they are read live from Razorpay at runtime, and
 * structured data that contradicts the page is worse than none at all. The free tier is
 * stated because it is fixed in the plan catalog.
 */
const product = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#app`,
  name: BRAND,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  description:
    'Transactional email over standard SMTP for apps built with Cursor, Claude, Lovable, Bolt and any other stack. DKIM signing, delivery logs and prepaid monthly plans.',
  featureList: [
    'Drop-in SMTP on ports 587 and 465',
    'DKIM signing and SPF alignment',
    'Delivery logs and bounce tracking',
    'Prepaid monthly plans with no auto-renewal',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    description: 'Free plan: 500 emails per month, no credit card required.',
  },
};

const howTo = {
  '@type': 'TechArticle',
  '@id': `${SITE_URL}/docs#article`,
  headline: 'How to send email over SMTP from any language or framework',
  url: `${SITE_URL}/docs`,
  publisher: { '@id': `${SITE_URL}/#organization` },
  description:
    'Copy-paste SMTP integration examples for Node.js, Next.js, Python, Django, Laravel, Rails, Go, Spring Boot, .NET, Supabase and no-code tools, plus common SMTP error codes.',
  proficiencyLevel: 'Beginner',
};

/**
 * One TechArticle per guide, built from the same entry that renders the page, so a guide
 * can never be indexed under a heading it does not have. `isPartOf` groups them under the
 * hub, which is what makes a set of pages read as a section rather than as strays.
 */
const guideArticle = (path: string, headline: string, description: string): unknown => ({
  '@type': 'TechArticle',
  '@id': `${SITE_URL}${path}#article`,
  headline,
  description,
  url: `${SITE_URL}${path}`,
  publisher: { '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@id': `${SITE_URL}/guides#collection` },
  proficiencyLevel: 'Beginner',
});

const guideCollection = {
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/guides#collection`,
  name: 'Email guides',
  url: `${SITE_URL}/guides`,
  description:
    'Setup guides for Supabase Auth, Lovable, Bolt and Next.js, a deliverability explainer, and honest provider comparisons.',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const faqPage = {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/pricing#faq`,
  mainEntity: FAQ.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: { '@type': 'Answer', text: entry.a },
  })),
};

export const SEO_ROUTES: SeoRoute[] = [
  {
    path: '/',
    title: 'SMTP Email for AI-Built Apps — Email4VibeCoder',
    description:
      'Transactional email for apps built with Cursor, Claude or Lovable. Four SMTP settings, or paste one prompt. 500 emails a month free, no card.',
    priority: '1.0',
    changefreq: 'weekly',
    jsonLd: [organization, website, product],
  },
  {
    path: '/pricing',
    title: 'Pricing — SMTP Email Plans from Free | Email4VibeCoder',
    description:
      'Affordable transactional email. Start free with 500 emails a month, then prepay monthly with UPI or cards. No auto-renewal and no overage fees.',
    priority: '0.9',
    changefreq: 'weekly',
    jsonLd: [faqPage],
  },
  {
    path: '/docs',
    title: 'SMTP Docs for Node, Python & Django — Email4VibeCoder',
    description:
      'Copy-paste SMTP setup for Node.js, Next.js, Python, Django, Laravel, Rails, Go, .NET and Supabase, plus what each SMTP error code means.',
    priority: '0.9',
    changefreq: 'monthly',
    jsonLd: [howTo],
  },
  {
    path: '/prompt',
    title: 'AI Prompt: Add Email to Your App — Email4VibeCoder',
    description:
      'Copy-paste prompts that tell Cursor, Claude Code, Lovable or Bolt exactly how to add transactional email over SMTP, including the constraints assistants usually get wrong.',
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/guides',
    title: 'Email Guides for Developers — Email4VibeCoder',
    description:
      'Setup guides for Supabase Auth, Lovable, Bolt and Next.js, why email lands in spam, and honest comparisons with SendGrid and Resend.',
    priority: '0.8',
    changefreq: 'weekly',
    jsonLd: [guideCollection],
  },
  // One route per entry in the guide registry: adding a guide there is enough for the
  // build to prerender it, link it from the hub and list it in the sitemap.
  ...GUIDES.map((guide): SeoRoute => ({
    path: guide.path,
    title: guide.seoTitle,
    description: guide.description,
    priority: '0.7',
    changefreq: 'monthly',
    jsonLd: [guideArticle(guide.path, guide.label, guide.description)],
  })),
  {
    path: '/terms',
    title: 'Terms of Service — Email4VibeCoder',
    description:
      'The terms governing Email4VibeCoder: acceptable use and anti-spam rules, prepaid billing, suspension, liability and governing law.',
    priority: '0.3',
    changefreq: 'yearly',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — Email4VibeCoder',
    description:
      'How Email4VibeCoder handles your data: what we store, who we share it with, and how long we keep email content and delivery logs.',
    priority: '0.3',
    changefreq: 'yearly',
  },
  {
    path: '/login',
    title: 'Sign in — Email4VibeCoder',
    description:
      'Sign in to manage your sending domains, SMTP credentials, delivery logs and billing.',
  },
  {
    path: '/register',
    title: 'Create a free account — Email4VibeCoder',
    description:
      'Create a free Email4VibeCoder account and send 500 emails a month over SMTP, with no credit card required.',
    priority: '0.8',
    changefreq: 'monthly',
  },
];

export const seoRouteFor = (path: string): SeoRoute | undefined =>
  SEO_ROUTES.find((r) => r.path === path);

/** Routes worth putting in the sitemap: public, indexable and stable. */
export const sitemapRoutes = (): SeoRoute[] => SEO_ROUTES.filter((r) => r.priority);
