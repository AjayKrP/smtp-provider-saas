import { beforeAll, describe, expect, it } from 'vitest';
import Handlebars from 'handlebars';

let renderEmail: typeof import('./render.js').renderEmail;

beforeAll(async () => {
  Object.assign(process.env, {
    API_PUBLIC_URL: 'https://app.test/api',
    DASHBOARD_URL: 'https://app.test',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
    MAIL_FROM: 'Email4VibeCoder <hello@brand.test>',
  });
  ({ renderEmail } = await import('./render.js'));
});

const samples = {
  'verify-email': { name: 'Ada', verifyUrl: 'https://app.test/verify-email?token=abc' },
  welcome: {
    name: 'Ada',
    dashboardUrl: 'https://app.test',
    domainsUrl: 'https://app.test/domains',
    credentialsUrl: 'https://app.test/credentials',
    freePlanName: 'Vibe',
    freeQuota: '500',
    paidFrom: '₹599',
    pricingUrl: 'https://app.test/pricing',
  },
  'password-reset': { name: 'Ada', resetUrl: 'https://app.test/reset-password?token=abc' },
  'account-exists': {
    name: 'Ada',
    signInUrl: 'https://app.test/login',
    resetUrl: 'https://app.test/reset-password?token=abc',
  },
  'payment-receipt': {
    name: 'Ada',
    planName: 'Ship',
    amount: '₹599.00',
    periodStart: '13 Sept 2026',
    periodEnd: '13 Oct 2026',
    paidOn: '13 Sept 2026',
    paymentId: 'pay_ABC123',
    orderId: 'order_XYZ789',
    billingUrl: 'https://app.test/billing',
  },
  'admin-new-signup': {
    name: 'Ada',
    email: 'ada@example.com',
    organizationName: "Ada's workspace",
    signedUpAt: '18 Sept 2026',
    totalUsers: '42',
    adminUrl: 'https://app.test/admin',
  },
  'admin-purchase': {
    name: 'Ada',
    email: 'ada@example.com',
    organizationName: "Ada's workspace",
    planName: 'Ship',
    amount: '₹599.00',
    paidOn: '18 Sept 2026',
    periodEnd: '18 Oct 2026',
    paymentId: 'pay_ABC123',
    orderId: 'order_XYZ789',
    adminUrl: 'https://app.test/admin',
  },
} as const;

describe('email templates', () => {
  it.each(Object.entries(samples))(
    '%s renders subject, HTML and text from the template files',
    (name, data) => {
      const email = renderEmail(name as keyof typeof samples, data as never);
      expect(email.subject.length).toBeGreaterThan(5);
      expect(email.subject).not.toMatch(/\{\{|undefined/);
      for (const part of [email.html, email.text]) {
        expect(part).not.toMatch(/\{\{|\}\}|undefined/);
        expect(part).toContain('Ada');
      }
      // Shared layout: brand and support address come from MAIL_FROM.
      expect(email.html).toContain('Email4VibeCoder');
      expect(email.html).toContain('mailto:hello@brand.test');
      expect(email.html).toContain('<title>');
      // Every URL passed in reaches both versions.
      for (const [key, value] of Object.entries(data)) {
        if (key.endsWith('Url')) {
          // HTML-escaped in the HTML version ("=" → "&#x3D;", which clients decode).
          expect(email.html).toContain(Handlebars.escapeExpression(value));
          expect(email.text).toContain(value);
        }
      }
    },
  );

  it('fills subjects from data', () => {
    expect(renderEmail('payment-receipt', samples['payment-receipt']).subject).toBe(
      'Payment received — your Ship plan is active',
    );
    expect(renderEmail('verify-email', samples['verify-email']).subject).toBe(
      'Confirm your email for Email4VibeCoder',
    );
  });

  it('escapes values in HTML but not in the plain-text version', () => {
    const email = renderEmail('password-reset', {
      ...samples['password-reset'],
      name: '<img src=x>',
    });
    expect(email.html).not.toContain('<img src=x>');
    expect(email.html).toContain(Handlebars.escapeExpression('<img src=x>'));
    expect(email.text).toContain('<img src=x>');
  });

  it('omits the optional paid-plan note when there is no price', () => {
    const email = renderEmail('welcome', { ...samples.welcome, paidFrom: null });
    expect(email.html).not.toContain('Paid plans');
    expect(email.text).not.toContain('Paid plans');
  });

  it('refuses to render when the caller forgets a variable', () => {
    expect(() => renderEmail('verify-email', { name: 'Ada' } as never)).toThrow(/verifyUrl/);
  });
});
