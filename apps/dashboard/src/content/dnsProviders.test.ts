import { describe, expect, it } from 'vitest';
import { PROVIDER_GUIDES, hostForProvider } from './dnsProviders.js';

const DKIM_HOST = 's1a2b3c4._domainkey.example.com';

describe('hostForProvider', () => {
  it('strips the domain for a field that appends it', () => {
    // The mistake this prevents: pasting the full hostname into Cloudflare's Name field
    // produces s1a2b3c4._domainkey.example.com.example.com, which resolves to nothing.
    expect(hostForProvider(DKIM_HOST, 'example.com', 'prefix')).toBe('s1a2b3c4._domainkey');
  });

  it('keeps the whole hostname for a field that does not', () => {
    expect(hostForProvider(DKIM_HOST, 'example.com', 'full')).toBe(DKIM_HOST);
  });

  it('uses @ for a record on the domain itself', () => {
    // The SPF record sits on the apex, where every prefix-style provider wants @.
    expect(hostForProvider('example.com', 'example.com', 'prefix')).toBe('@');
  });

  it('handles the DMARC record, which is one label deep', () => {
    expect(hostForProvider('_dmarc.example.com', 'example.com', 'prefix')).toBe('_dmarc');
  });

  it('leaves the host alone when the provider is unknown', () => {
    // Undefined means detection found nothing; showing the full hostname is the safe
    // default, and the generic note tells the reader how to shorten it.
    expect(hostForProvider(DKIM_HOST, 'example.com', undefined)).toBe(DKIM_HOST);
  });

  it('does not mangle a host that does not end with the domain', () => {
    expect(hostForProvider('other.example.net', 'example.com', 'prefix')).toBe('other.example.net');
  });

  it('works on a subdomain being verified for sending', () => {
    expect(hostForProvider('s1._domainkey.mail.example.com', 'mail.example.com', 'prefix')).toBe(
      's1._domainkey',
    );
  });
});

describe('PROVIDER_GUIDES', () => {
  it('gives every provider a path and a declared name-field style', () => {
    for (const [id, guide] of Object.entries(PROVIDER_GUIDES)) {
      expect(guide.path, id).toBeTruthy();
      expect(['prefix', 'full'], id).toContain(guide.nameField);
    }
  });

  it('covers Route 53’s quoting rule, which breaks DKIM if missed', () => {
    const notes = PROVIDER_GUIDES.route53!.notes.join(' ');
    expect(notes).toMatch(/quote/i);
    expect(notes).toMatch(/255/);
  });
});
