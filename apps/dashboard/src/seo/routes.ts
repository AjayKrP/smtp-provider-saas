import { FAQ } from '../content/faq.js';

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
