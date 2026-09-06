/** Extract the bare address from a header value like `"Name" <a@b.com>`. */
export function extractAddress(headerValue: string): string | null {
  const angle = headerValue.match(/<([^>]+)>/);
  const raw = (angle?.[1] ?? headerValue).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}

export function domainOf(address: string): string | null {
  const at = address.lastIndexOf('@');
  if (at === -1) return null;
  const domain = address.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/** Group recipient addresses by their domain, preserving order within a group. */
export function groupByDomain(addresses: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const addr of addresses) {
    const domain = domainOf(addr);
    if (!domain) continue;
    const bucket = groups.get(domain);
    if (bucket) bucket.push(addr);
    else groups.set(domain, [addr]);
  }
  return groups;
}
