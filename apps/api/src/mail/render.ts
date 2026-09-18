import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { env } from '../env.js';
import { mailSender } from './sender.js';

/**
 * Email templates live as files in ./templates — never as strings in code:
 *
 *   <name>.html   front matter (subject, preheader) + HTML body, wrapped in partials/layout.html
 *   <name>.txt    plain-text version
 *   partials/*.html   shared pieces: {{> button url=… label="…"}}, {{#> heading}}…{{/heading}}
 *
 * Values are HTML-escaped automatically, and rendering is strict: a variable the
 * template uses but the caller didn't pass throws instead of sending "Hi ,".
 * Code only supplies data; see EmailTemplates for what each template receives.
 */
export interface EmailTemplates {
  'verify-email': { name: string; verifyUrl: string };
  welcome: {
    name: string;
    dashboardUrl: string;
    domainsUrl: string;
    credentialsUrl: string;
    freePlanName: string;
    freeQuota: string;
    paidFrom: string | null;
    pricingUrl: string;
  };
  'password-reset': { name: string; resetUrl: string };
  'account-exists': { name: string; signInUrl: string; resetUrl: string };
  'payment-receipt': {
    name: string;
    planName: string;
    amount: string;
    periodStart: string;
    periodEnd: string;
    paidOn: string;
    paymentId: string;
    orderId: string;
    billingUrl: string;
  };
  // Sent to ADMIN_EMAILS, not to customers.
  'admin-new-signup': {
    name: string;
    email: string;
    organizationName: string;
    signedUpAt: string;
    totalUsers: string;
    adminUrl: string;
  };
  'admin-purchase': {
    name: string;
    email: string;
    organizationName: string;
    planName: string;
    amount: string;
    paidOn: string;
    periodEnd: string;
    paymentId: string;
    orderId: string;
    adminUrl: string;
  };
}

export type EmailTemplateName = keyof EmailTemplates;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const TEMPLATE_DIR = fileURLToPath(new URL('./templates/', import.meta.url));

const hbs = Handlebars.create();
// {{> detail-row value=(concat periodStart " – " periodEnd)}}
hbs.registerHelper('concat', (...args: unknown[]) => args.slice(0, -1).join(''));
for (const file of readdirSync(`${TEMPLATE_DIR}partials`)) {
  if (file.endsWith('.html')) {
    hbs.registerPartial(file.slice(0, -5), readFileSync(`${TEMPLATE_DIR}partials/${file}`, 'utf8'));
  }
}

const STRICT = { strict: true } as const;
const TEXT = { strict: true, noEscape: true } as const;

interface Compiled {
  subject: HandlebarsTemplateDelegate;
  preheader: HandlebarsTemplateDelegate;
  html: HandlebarsTemplateDelegate;
  text: HandlebarsTemplateDelegate;
}

const cache = new Map<string, Compiled>();
const layout = hbs.compile(readFileSync(`${TEMPLATE_DIR}partials/layout.html`, 'utf8'), STRICT);

function parseFrontMatter(
  source: string,
  file: string,
): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`${file}: missing front matter (--- subject: … ---)`);
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const kv = /^\s*([a-z]+)\s*:\s*(.*)$/i.exec(line);
    if (kv) meta[kv[1]!] = kv[2]!.trim();
  }
  if (!meta.subject) throw new Error(`${file}: front matter needs a subject`);
  return { meta, body: match[2]! };
}

function compile(name: string): Compiled {
  let compiled = cache.get(name);
  if (!compiled) {
    const file = `${name}.html`;
    const { meta, body } = parseFrontMatter(readFileSync(`${TEMPLATE_DIR}${file}`, 'utf8'), file);
    compiled = {
      subject: hbs.compile(meta.subject, TEXT),
      preheader: hbs.compile(meta.preheader ?? '', TEXT),
      html: hbs.compile(body, STRICT),
      text: hbs.compile(readFileSync(`${TEMPLATE_DIR}${name}.txt`, 'utf8'), TEXT),
    };
    cache.set(name, compiled);
  }
  return compiled;
}

export function renderEmail<N extends EmailTemplateName>(
  name: N,
  data: EmailTemplates[N],
): RenderedEmail {
  const t = compile(name);
  const context = {
    ...mailSender(),
    appUrl: env.DASHBOARD_URL.replace(/\/$/, ''),
    year: new Date().getFullYear(),
    ...data,
  };
  const subject = t.subject(context);
  return {
    subject,
    html: layout({
      ...context,
      subject,
      preheader: t.preheader(context),
      content: t.html(context),
    }),
    text: t.text(context),
  };
}
