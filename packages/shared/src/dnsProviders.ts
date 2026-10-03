/**
 * Recognising where a domain's DNS is actually hosted, from its nameservers.
 *
 * This exists because "paste these records into your DNS" is where most setups stall,
 * and the reasons are provider-specific: one wants the subdomain in the Name field,
 * another wants the whole hostname, a third silently truncates a long TXT value. Knowing
 * the provider lets the dashboard give instructions for the screen the customer is
 * actually looking at.
 *
 * The registrar is irrelevant here — what matters is who answers for the zone, which is
 * exactly what the NS records say. A domain bought at GoDaddy but moved to Cloudflare is
 * a Cloudflare domain for this purpose.
 */

export interface DnsProvider {
  id: string;
  name: string;
  /** Where the customer manages records. Omitted when there is no stable URL. */
  dnsUrl?: string;
}

/**
 * Matched as a substring of a nameserver hostname, most specific first. Substring rather
 * than suffix because Route 53 and Azure encode the provider in the middle of the name
 * (`ns-123.awsdns-45.co.uk`), and a suffix match would miss every regional variant.
 */
const SIGNATURES: { match: string[]; provider: DnsProvider }[] = [
  {
    match: ['ns.cloudflare.com'],
    provider: {
      id: 'cloudflare',
      name: 'Cloudflare',
      dnsUrl: 'https://dash.cloudflare.com/?to=/:account/:zone/dns',
    },
  },
  {
    match: ['domaincontrol.com'],
    provider: {
      id: 'godaddy',
      name: 'GoDaddy',
      dnsUrl: 'https://dcc.godaddy.com/control/dnsmanagement',
    },
  },
  {
    match: ['registrar-servers.com', 'namecheaphosting.com'],
    provider: {
      id: 'namecheap',
      name: 'Namecheap',
      dnsUrl: 'https://ap.www.namecheap.com/domains/list',
    },
  },
  {
    match: ['awsdns-'],
    provider: {
      id: 'route53',
      name: 'Amazon Route 53',
      dnsUrl: 'https://console.aws.amazon.com/route53/v2/hostedzones',
    },
  },
  {
    match: ['azure-dns.'],
    provider: { id: 'azure', name: 'Azure DNS' },
  },
  {
    match: ['googledomains.com'],
    provider: { id: 'googlecloud', name: 'Google Cloud DNS or Google Domains' },
  },
  {
    match: ['squarespacedns.com'],
    provider: { id: 'squarespace', name: 'Squarespace' },
  },
  {
    match: ['digitalocean.com'],
    provider: {
      id: 'digitalocean',
      name: 'DigitalOcean',
      dnsUrl: 'https://cloud.digitalocean.com/networking/domains',
    },
  },
  {
    match: ['vercel-dns.com'],
    provider: { id: 'vercel', name: 'Vercel', dnsUrl: 'https://vercel.com/dashboard/domains' },
  },
  {
    match: ['nsone.net'],
    provider: { id: 'netlify', name: 'Netlify or NS1' },
  },
  {
    match: ['dns-parking.com', 'hostinger.com'],
    provider: { id: 'hostinger', name: 'Hostinger', dnsUrl: 'https://hpanel.hostinger.com/' },
  },
  {
    // The ResellerClub platform, which BigRock and many Indian hosts resell.
    match: ['bigrock.in', 'resellerclub.com', 'myorderbox.com'],
    provider: { id: 'resellerclub', name: 'BigRock or another ResellerClub host' },
  },
  {
    match: ['hostgator.in', 'websitewelcome.com'],
    provider: { id: 'hostgator', name: 'HostGator' },
  },
  {
    match: ['milesweb.in'],
    provider: { id: 'milesweb', name: 'MilesWeb' },
  },
  {
    match: ['hichina.com', 'alidns.com'],
    provider: { id: 'alibaba', name: 'Alibaba Cloud' },
  },
  {
    match: ['porkbun.com'],
    provider: { id: 'porkbun', name: 'Porkbun' },
  },
  {
    match: ['dnsimple.com'],
    provider: { id: 'dnsimple', name: 'DNSimple' },
  },
  {
    match: ['name.com'],
    provider: { id: 'namecom', name: 'Name.com' },
  },
  {
    match: ['bluehost.com'],
    provider: { id: 'bluehost', name: 'Bluehost' },
  },
  {
    match: ['gandi.net'],
    provider: { id: 'gandi', name: 'Gandi' },
  },
  {
    match: ['zoho.com', 'zohodns'],
    provider: { id: 'zoho', name: 'Zoho' },
  },
];

/**
 * Identify the DNS host from a domain's nameservers, or null when none is recognised.
 *
 * Null is a normal answer, not a failure: plenty of domains sit on a host we have never
 * heard of, and the dashboard falls back to generic instructions. Guessing wrong would be
 * worse than not guessing — instructions naming the wrong screen read as broken.
 */
export function providerFromNameservers(nameservers: string[]): DnsProvider | null {
  const hosts = nameservers.map((ns) => ns.toLowerCase().replace(/\.$/, ''));
  for (const { match, provider } of SIGNATURES) {
    if (hosts.some((host) => match.some((needle) => host.includes(needle)))) return provider;
  }
  return null;
}

export const dnsProviderById = (id: string | null | undefined): DnsProvider | null =>
  (id && SIGNATURES.find((s) => s.provider.id === id)?.provider) || null;
