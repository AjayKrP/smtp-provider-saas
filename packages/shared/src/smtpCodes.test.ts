import { describe, expect, it } from 'vitest';
import { classifySmtpCode, outcomeFromError } from './smtpCodes.js';

describe('classifySmtpCode', () => {
  it('2xx is delivered', () => expect(classifySmtpCode(250)).toBe('delivered'));
  it('4xx is deferred', () => expect(classifySmtpCode(451)).toBe('deferred'));
  it('5xx is bounced', () => expect(classifySmtpCode(550)).toBe('bounced'));
  it('missing code is deferred', () => expect(classifySmtpCode(undefined)).toBe('deferred'));
});

describe('outcomeFromError', () => {
  it('reads responseCode from an SMTP error', () => {
    expect(outcomeFromError({ responseCode: 550, response: '550 no such user' })).toEqual({
      outcome: 'bounced',
      code: 550,
      response: '550 no such user',
    });
  });
  it('treats a bare connection error as deferred', () => {
    expect(outcomeFromError(new Error('ECONNREFUSED')).outcome).toBe('deferred');
  });
});
