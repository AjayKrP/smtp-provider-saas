/**
 * Pricing FAQ. Plain data, no JSX: the pricing page renders it and the build bakes it
 * into FAQPage structured data, so the two can never drift apart.
 */
export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQ: FaqEntry[] = [
  {
    q: 'I built my app with an AI tool. Will this work?',
    a: 'Yes. We use standard SMTP, which every framework and AI coding assistant already knows. Copy the AI prompt from the home page into Cursor, Claude, Lovable, Bolt or Replit, add your credentials as environment variables, and it wires up the rest.',
  },
  {
    q: 'Is there really a free plan?',
    a: 'Yes — 500 emails a month on one domain, free, with no credit card. It is plenty for a side project or an MVP; upgrade when you outgrow it.',
  },
  {
    q: 'What counts as an email?',
    a: 'Every recipient of a message accepted by our SMTP server counts as one email. Quotas reset at the start of each calendar month.',
  },
  {
    q: 'How does billing work?',
    a: 'Plans are prepaid one month at a time through Razorpay — pay with UPI, cards, netbanking or wallets. Nothing renews automatically: when a month ends you move to the free Vibe plan’s limits until you pay again.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Buy a different plan from the Billing page whenever you like and it starts right away. Paying for the plan you are already on adds another month to it.',
  },
  {
    q: 'What happens if I hit my monthly limit?',
    a: 'New messages are rejected with a temporary SMTP error until the next month or until you upgrade, so your app can retry safely.',
  },
  {
    q: 'Do I need to change my code?',
    a: 'No. Any library, framework or mail client that speaks SMTP works — just swap in the host, port and credentials from your dashboard.',
  },
];
