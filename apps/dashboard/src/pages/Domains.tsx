import { useState } from 'react';
import {
  useAddDomain,
  useDomains,
  useVerifyDomain,
  useDeleteDomain,
  type Domain,
} from '../api/hooks.js';
import { apiErrorMessage } from '../api/client.js';
import { CopyButton, Empty, Icon, PageHeader, StatusBadge, when } from '../components/bits.js';
import {
  NAME_FIELD_HELP,
  PROVIDER_GUIDES,
  hostForProvider,
  type ProviderGuide,
} from '../content/dnsProviders.js';

/**
 * Instructions for the DNS host this domain actually sits on, detected from its
 * nameservers by the API. The point is not the menu path: it is that the Host column
 * below can then show the exact string this provider's form expects, which is where most
 * setups go wrong.
 */
function ProviderHelp({ domain, guide }: { domain: Domain; guide?: ProviderGuide }) {
  const nameserver = domain.nameservers[0];

  return (
    <div className="provider-help">
      {guide ? (
        <>
          <p>
            <strong>Your DNS is hosted at {providerName(domain.dnsProvider)}.</strong> {guide.path}.
          </p>
          {guide.notes.length > 0 && (
            <ul>
              {guide.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p>
          {nameserver ? (
            <>
              <strong>Your DNS is answered by {nameserver}.</strong> We do not have step-by-step
              instructions for that host, so the records below are shown in full.
            </>
          ) : (
            <>Add these records wherever your domain&apos;s DNS is managed.</>
          )}
        </p>
      )}
      <p className="muted small">{NAME_FIELD_HELP}</p>
    </div>
  );
}

/** Display name for a detected provider id, for the one line that needs it. */
function providerName(id: string | null): string {
  const names: Record<string, string> = {
    cloudflare: 'Cloudflare',
    godaddy: 'GoDaddy',
    namecheap: 'Namecheap',
    route53: 'Amazon Route 53',
    digitalocean: 'DigitalOcean',
    vercel: 'Vercel',
    netlify: 'Netlify or NS1',
    hostinger: 'Hostinger',
    resellerclub: 'BigRock or another ResellerClub host',
    hostgator: 'HostGator',
    azure: 'Azure DNS',
    googlecloud: 'Google Cloud DNS',
    squarespace: 'Squarespace',
    milesweb: 'MilesWeb',
    porkbun: 'Porkbun',
    dnsimple: 'DNSimple',
    namecom: 'Name.com',
    bluehost: 'Bluehost',
    gandi: 'Gandi',
    zoho: 'Zoho',
    alibaba: 'Alibaba Cloud',
  };
  return (id && names[id]) || 'your DNS provider';
}

function DnsTable({ domain }: { domain: Domain }) {
  const guide = domain.dnsProvider ? PROVIDER_GUIDES[domain.dnsProvider] : undefined;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Host</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {domain.dnsRecords.map((r, i) => (
            <tr key={i}>
              <td>
                <span className="badge plain">{r.type}</span>
              </td>
              <td>
                <div className="copy-field">
                  <code>{hostForProvider(r.host, domain.domain, guide?.nameField)}</code>
                  <CopyButton
                    value={hostForProvider(r.host, domain.domain, guide?.nameField)}
                    label="Copy host"
                  />
                </div>
              </td>
              <td style={{ maxWidth: 420 }}>
                <div className="copy-field">
                  <code>{r.value}</code>
                  <CopyButton value={r.value} label="Copy value" />
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {r.purpose}
                </div>
              </td>
              <td>{r.required ? <span className="badge warn plain">Required</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`badge ${ok ? 'ok' : 'warn'}`} style={{ textTransform: 'none' }}>
      {label} {ok ? 'verified' : 'pending'}
    </span>
  );
}

function DomainCard({ domain }: { domain: Domain }) {
  const verify = useVerifyDomain();
  const del = useDeleteDomain();
  const [msg, setMsg] = useState('');

  return (
    <div className="card flush">
      <div className="card-head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {domain.domain} <StatusBadge status={domain.status} />
          </h2>
          <p>Last checked {when(domain.lastCheckedAt)}</p>
        </div>
        <div className="row">
          <Check ok={domain.dkimVerified} label="DKIM" />
          <Check ok={domain.spfVerified} label="SPF" />
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)' }}>
        <ProviderHelp
          domain={domain}
          guide={domain.dnsProvider ? PROVIDER_GUIDES[domain.dnsProvider] : undefined}
        />
        <DnsTable domain={domain} />
      </div>
      <div
        className="row"
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel-2)',
        }}
      >
        <button
          className="primary sm"
          disabled={verify.isPending}
          onClick={async () => {
            setMsg('');
            try {
              const res = await verify.mutateAsync(domain.id);
              setMsg(
                Object.entries(res.verification)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · '),
              );
            } catch (err) {
              setMsg(apiErrorMessage(err));
            }
          }}
        >
          <Icon name="refresh" size={14} />
          {verify.isPending ? 'Checking…' : 'Verify DNS'}
        </button>
        <button
          className="sm danger"
          onClick={() => {
            if (confirm(`Remove ${domain.domain}?`)) del.mutate(domain.id);
          }}
        >
          Remove
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </div>
  );
}

export function Domains() {
  const { data, isLoading } = useDomains();
  const add = useAddDomain();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await add.mutateAsync(value.trim().toLowerCase());
      setValue('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Sending domains"
        description="Verify the domains you send from so mail is DKIM-signed and trusted by inboxes."
      />

      <form className="card" onSubmit={submit}>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 200 }}
            placeholder="yourcompany.com"
            aria-label="Domain"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <button className="primary" disabled={add.isPending}>
            <Icon name="plus" size={15} />
            {add.isPending ? 'Adding…' : 'Add domain'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>

      {isLoading && <p className="muted">Loading…</p>}
      {data?.length === 0 && (
        <div className="card">
          <Empty icon="globe" title="No domains yet">
            Add your first domain above to get DNS records to publish.
          </Empty>
        </div>
      )}
      {data?.map((d) => (
        <DomainCard key={d.id} domain={d} />
      ))}
    </>
  );
}
