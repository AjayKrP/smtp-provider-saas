import { describe, expect, it } from 'vitest';
import { domainOf, extractAddress, groupByDomain } from './email.js';

describe('extractAddress', () => {
  it('parses a bare address', () => {
    expect(extractAddress('user@example.com')).toBe('user@example.com');
  });
  it('parses a display-name address', () => {
    expect(extractAddress('"Jane Doe" <Jane@Example.com>')).toBe('jane@example.com');
  });
  it('rejects garbage', () => {
    expect(extractAddress('not an address')).toBeNull();
    expect(extractAddress('foo@bar')).toBeNull();
  });
});

describe('domainOf', () => {
  it('returns the domain', () => {
    expect(domainOf('a@b.co.uk')).toBe('b.co.uk');
  });
  it('handles missing @', () => {
    expect(domainOf('nope')).toBeNull();
  });
});

describe('groupByDomain', () => {
  it('groups and preserves order', () => {
    const groups = groupByDomain(['a@x.com', 'b@y.com', 'c@x.com']);
    expect([...groups.keys()]).toEqual(['x.com', 'y.com']);
    expect(groups.get('x.com')).toEqual(['a@x.com', 'c@x.com']);
  });
});
