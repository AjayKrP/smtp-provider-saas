import { describe, expect, it } from 'vitest';
import { dnsProviderById, providerFromNameservers } from './dnsProviders.js';

describe('providerFromNameservers', () => {
  it('recognises Cloudflare', () => {
    expect(providerFromNameservers(['kara.ns.cloudflare.com', 'rob.ns.cloudflare.com'])?.id).toBe(
      'cloudflare',
    );
  });

  it('ignores a trailing dot and letter case, as a resolver returns them', () => {
    expect(providerFromNameservers(['KARA.NS.CLOUDFLARE.COM.'])?.id).toBe('cloudflare');
  });

  it('recognises Route 53 across its regional suffixes', () => {
    // The provider sits in the middle of the hostname, which is why matching is on a
    // substring rather than a suffix.
    for (const ns of ['ns-1.awsdns-01.com', 'ns-2.awsdns-23.co.uk', 'ns-3.awsdns-45.org']) {
      expect(providerFromNameservers([ns])?.id).toBe('route53');
    }
  });

  it('recognises the hosts this product’s customers actually use', () => {
    expect(providerFromNameservers(['ns01.domaincontrol.com'])?.id).toBe('godaddy');
    expect(providerFromNameservers(['dns1.registrar-servers.com'])?.id).toBe('namecheap');
    expect(providerFromNameservers(['ns1.bigrock.in'])?.id).toBe('resellerclub');
    expect(providerFromNameservers(['ns1.dns-parking.com'])?.id).toBe('hostinger');
    expect(providerFromNameservers(['ns1.vercel-dns.com'])?.id).toBe('vercel');
  });

  it('returns null for an unrecognised host rather than guessing', () => {
    // Naming the wrong screen is worse than naming none: the instructions would read as
    // broken, and the customer cannot tell which part to ignore.
    expect(providerFromNameservers(['ns1.some-tiny-host.example'])).toBeNull();
    expect(providerFromNameservers([])).toBeNull();
  });
});

describe('dnsProviderById', () => {
  it('round-trips a detected id', () => {
    const detected = providerFromNameservers(['kara.ns.cloudflare.com'])!;
    expect(dnsProviderById(detected.id)).toEqual(detected);
  });

  it('is null for nothing, an empty string or an unknown id', () => {
    expect(dnsProviderById(null)).toBeNull();
    expect(dnsProviderById('')).toBeNull();
    expect(dnsProviderById('not-a-provider')).toBeNull();
  });
});
