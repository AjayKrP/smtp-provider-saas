/**
 * Per-provider DNS instructions, keyed by the id the API detects from the nameservers.
 *
 * The detection lives on the server; the words live here. What makes this worth having
 * is not the menu path — it is `nameField`, because almost every failed setup comes from
 * the same mistake: pasting the whole hostname into a field that already appends the
 * domain, producing `_domainkey.example.com.example.com`. Knowing which kind of field a
 * provider shows lets the dashboard print the exact string to paste.
 *
 * Everything here is a claim about someone else's UI, so it can go out of date. The
 * generic note shown alongside every provider is written to make a wrong guess harmless.
 */
export interface ProviderGuide {
  /** Where the DNS records live, in that provider's own menu wording. */
  path: string;
  /**
   * 'prefix' — the Name/Host field appends the domain, so paste only the part before it
   * (and `@` for the domain itself). 'full' — paste the complete hostname.
   */
  nameField: 'prefix' | 'full';
  /** The traps specific to this provider. One sentence each, most important first. */
  notes: string[];
}

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  cloudflare: {
    path: 'Select your domain → DNS → Records → Add record',
    nameField: 'prefix',
    notes: [
      'Paste the value without quotation marks — Cloudflare adds its own.',
      'Leave TTL on Auto.',
      'TXT records are never proxied, so the orange-cloud setting does not apply to these. It does matter for any mail hostname: those must stay DNS-only.',
    ],
  },
  godaddy: {
    path: 'My Products → your domain → DNS → Add New Record',
    nameField: 'prefix',
    notes: [
      'Paste the DKIM value as a single line. GoDaddy’s box is small and a line break inside the key is the most common reason verification fails.',
      'The field is labelled Host rather than Name.',
      'GoDaddy’s shortest TTL is one hour, so allow for that before re-checking.',
    ],
  },
  namecheap: {
    path: 'Domain List → Manage → Advanced DNS → Add New Record',
    nameField: 'prefix',
    notes: [
      'Use the Advanced DNS tab, not Domain → Nameservers.',
      'The field is labelled Host. Use @ for the domain itself.',
      'Paste the value without quotation marks.',
    ],
  },
  route53: {
    path: 'Hosted zones → your zone → Create record',
    nameField: 'prefix',
    notes: [
      'Route 53 requires TXT values to be wrapped in double quotes — type them yourself.',
      'A value longer than 255 characters must be split into several quoted strings on one line, like "first-part" "second-part". A DKIM key is longer than that, so this applies to it.',
      'Choose Simple routing.',
    ],
  },
  digitalocean: {
    path: 'Networking → Domains → your domain',
    nameField: 'prefix',
    notes: [
      'The field is labelled Hostname. Use @ for the domain itself.',
      'Paste the value without quotation marks.',
    ],
  },
  vercel: {
    path: 'Dashboard → Domains → your domain → DNS Records',
    nameField: 'prefix',
    notes: ['Leave the Name field empty, not @, for a record on the domain itself.'],
  },
  netlify: {
    path: 'Domains → your domain → DNS records → Add new record',
    nameField: 'prefix',
    notes: ['Paste the value without quotation marks.'],
  },
  hostinger: {
    path: 'hPanel → Domains → your domain → DNS / Nameservers → Manage DNS records',
    nameField: 'prefix',
    notes: [
      'Use @ in the Name field for a record on the domain itself.',
      'Delete any placeholder TXT record Hostinger added for the same name first — two SPF records on one domain is a permanent failure.',
    ],
  },
  resellerclub: {
    path: 'Domain order → DNS Management → Manage DNS → TXT Records',
    nameField: 'prefix',
    notes: [
      'The field is labelled Host Name.',
      'DNS Management only appears if the domain is using the host’s own nameservers.',
    ],
  },
  hostgator: {
    path: 'cPanel → Zone Editor → Manage → Add Record',
    nameField: 'full',
    notes: [
      'cPanel wants the complete hostname and will append your domain again if you leave off the trailing dot — check the saved record reads what you expect.',
      'Pick TXT from the Type dropdown before filling in the value.',
    ],
  },
  azure: {
    path: 'DNS zones → your zone → Record sets → Add',
    nameField: 'prefix',
    notes: ['Use @ in the Name field for a record on the zone itself.'],
  },
  googlecloud: {
    path: 'Cloud DNS → your zone → Add standard record set',
    nameField: 'prefix',
    notes: [
      'Each TXT value goes on its own line in the value box.',
      'If this is a Google Domains name that moved to Squarespace, manage it there instead.',
    ],
  },
  squarespace: {
    path: 'Domains → your domain → DNS → DNS Settings → Add record',
    nameField: 'prefix',
    notes: ['Use @ in the Host field for a record on the domain itself.'],
  },
  milesweb: {
    path: 'Client area → Domains → Manage DNS',
    nameField: 'prefix',
    notes: [],
  },
  porkbun: {
    path: 'Domain Management → your domain → DNS Records',
    nameField: 'prefix',
    notes: ['Leave the host field empty for a record on the domain itself.'],
  },
  dnsimple: {
    path: 'your domain → DNS → Manage records → Add record',
    nameField: 'prefix',
    notes: [],
  },
  namecom: {
    path: 'My Domains → your domain → Manage DNS Records',
    nameField: 'prefix',
    notes: [],
  },
  bluehost: {
    path: 'Domains → your domain → DNS → Add Record',
    nameField: 'prefix',
    notes: [],
  },
  gandi: {
    path: 'Domain → DNS Records → Add',
    nameField: 'prefix',
    notes: ['Paste the value without quotation marks.'],
  },
  zoho: {
    path: 'Zoho DNS → your domain → Manage DNS',
    nameField: 'prefix',
    notes: [],
  },
  alibaba: {
    path: 'Domain console → DNS → Add Record',
    nameField: 'prefix',
    notes: [],
  },
};

/**
 * The record name in the form this provider's form expects.
 *
 * With a 'prefix' provider the domain is stripped, because the field adds it back; a
 * record on the domain itself becomes `@`, which every such provider understands.
 */
export function hostForProvider(
  host: string,
  domain: string,
  nameField: ProviderGuide['nameField'] | undefined,
): string {
  if (nameField !== 'prefix') return host;
  if (host === domain) return '@';
  return host.endsWith(`.${domain}`) ? host.slice(0, -(domain.length + 1)) : host;
}

/**
 * Shown whatever the provider, including when none was recognised. It is the hedge that
 * makes a wrong guess above cost nothing: the reader can see both forms and pick.
 */
export const NAME_FIELD_HELP =
  'If the Name or Host field shows your domain beside it, paste only the first part. If it does not, paste the whole hostname.';
