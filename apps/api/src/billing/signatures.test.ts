import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hmacSha256Matches } from './signatures.js';

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('hmacSha256Matches', () => {
  it('accepts a checkout signature over "order_id|payment_id"', () => {
    const sig = sign('order_Abc|pay_Xyz', 'key_secret');
    expect(hmacSha256Matches('order_Abc|pay_Xyz', 'key_secret', sig)).toBe(true);
  });

  it('accepts a webhook signature over the raw body bytes', () => {
    const body = Buffer.from('{"event":"order.paid"}');
    expect(hmacSha256Matches(body, 'whsec', sign(body.toString(), 'whsec'))).toBe(true);
  });

  it('rejects a wrong secret, tampered payload or malformed signature', () => {
    const sig = sign('order_Abc|pay_Xyz', 'key_secret');
    expect(hmacSha256Matches('order_Abc|pay_Xyz', 'other', sig)).toBe(false);
    expect(hmacSha256Matches('order_Abc|pay_Evil', 'key_secret', sig)).toBe(false);
    expect(hmacSha256Matches('order_Abc|pay_Xyz', 'key_secret', 'short')).toBe(false);
  });

  it('fails closed when the secret is not configured', () => {
    expect(hmacSha256Matches('x', undefined, sign('x', ''))).toBe(false);
  });
});
