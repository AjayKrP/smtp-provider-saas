/**
 * The guide and comparison pages, as plain data.
 *
 * One list, three consumers that must never disagree: the /guides hub renders the cards,
 * seo/routes.ts turns each entry into a prerendered route with its own title, description
 * and TechArticle markup, and the sitemap picks them up from there. Adding a page here is
 * all it takes for the build to emit it — the only other step is a route in App.tsx.
 *
 * Deliberately free of JSX: this module is imported by the Node build as well as the
 * browser bundle. The page bodies live in src/pages/guides and src/pages/compare.
 */
export interface GuideEntry {
  path: string;
  /** Card heading on the hub, and the link text used in cross-references. */
  label: string;
  /** <title> for the route. */
  seoTitle: string;
  /** Meta description, and the card's supporting line. */
  description: string;
  /** Which shelf of the hub it sits on. */
  group: 'integration' | 'deliverability' | 'comparison';
  /** Roughly how long the page takes to work through, shown on the card. */
  minutes: number;
}

export const GUIDES: GuideEntry[] = [
  {
    path: '/guides/supabase-smtp-settings',
    label: 'SMTP settings for Supabase Auth',
    seoTitle: 'Supabase Auth SMTP Settings — Email4VibeCoder',
    description:
      'Exact custom SMTP settings for Supabase Auth: host, port 587, username, password and sender address, plus the rate limit and sender-domain rules that break most setups.',
    group: 'integration',
    minutes: 5,
  },
  {
    path: '/guides/send-email-from-lovable',
    label: 'Send email from a Lovable app',
    seoTitle: 'How to Send Email from a Lovable App — Email4VibeCoder',
    description:
      'Add sign-up and password-reset email to a Lovable app over SMTP. Why it has to run in a Supabase edge function, which mail library works there, and the settings to paste in.',
    group: 'integration',
    minutes: 8,
  },
  {
    path: '/guides/send-email-from-bolt',
    label: 'Send email from a Bolt app',
    seoTitle: 'How to Send Email from a Bolt.new App — Email4VibeCoder',
    description:
      'Send transactional email from an app built in Bolt.new. Why SMTP cannot work in the in-browser preview, where to put the send code, and the settings to use once deployed.',
    group: 'integration',
    minutes: 8,
  },
  {
    path: '/guides/send-email-from-nextjs',
    label: 'Send email from Next.js',
    seoTitle: 'Send Email from Next.js over SMTP — Email4VibeCoder',
    description:
      'Send email from a Next.js route handler or server action with Nodemailer, including the Node runtime setting that silently breaks SMTP on the edge, and a working example.',
    group: 'integration',
    minutes: 8,
  },
  {
    path: '/guides/why-emails-go-to-spam',
    label: 'Why your emails go to spam',
    seoTitle: 'Why Do My Emails Go to Spam? SPF, DKIM & DMARC — Email4VibeCoder',
    description:
      'The three DNS records that decide whether your app’s email reaches the inbox, what each one actually proves, how to read a failure, and the non-DNS reasons mail still lands in spam.',
    group: 'deliverability',
    minutes: 10,
  },
  {
    path: '/compare/sendgrid-alternative-india',
    label: 'SendGrid alternative for India',
    seoTitle: 'SendGrid Alternative for India (UPI, No Card) — Email4VibeCoder',
    description:
      'An honest comparison for Indian developers: INR pricing paid by UPI, plain SMTP with no SDK, and where SendGrid is still the better choice. No lock-in either way.',
    group: 'comparison',
    minutes: 6,
  },
  {
    path: '/compare/resend-alternative-india',
    label: 'Resend alternative without an international card',
    seoTitle: 'Resend Alternative — No International Card Needed | Email4VibeCoder',
    description:
      'Resend bills in USD and needs an international card. If that is the blocker, here is what changes, what you give up, and how to move an app across in about ten minutes.',
    group: 'comparison',
    minutes: 6,
  },
];

export const GUIDE_GROUPS: { id: GuideEntry['group']; title: string; blurb: string }[] = [
  {
    id: 'integration',
    title: 'Wiring it up',
    blurb: 'The exact settings for the tools people build with, with the gotchas called out.',
  },
  {
    id: 'deliverability',
    title: 'Reaching the inbox',
    blurb: 'Why mail lands in spam, and what to change so it stops.',
  },
  {
    id: 'comparison',
    title: 'Picking a provider',
    blurb: 'Straight comparisons, including where the other one wins.',
  },
];

export const guideFor = (path: string): GuideEntry | undefined =>
  GUIDES.find((g) => g.path === path);

/** Two sibling pages to link at the foot of a guide, never the page itself. */
export function relatedGuides(path: string, count = 2): GuideEntry[] {
  const self = guideFor(path);
  const others = GUIDES.filter((g) => g.path !== path);
  const sameGroup = others.filter((g) => g.group === self?.group);
  const rest = others.filter((g) => g.group !== self?.group);
  return [...sameGroup, ...rest].slice(0, count);
}
