import { Link } from 'react-router-dom';
import { CodeBlock } from '../../components/CodeBlock.js';
import { DocPage, type DocSection } from '../../components/DocPage.js';
import { RelatedGuides } from './GuidesIndex.js';

const PATH = '/guides/why-emails-go-to-spam';

const SECTIONS: DocSection[] = [
  {
    id: 'three-records',
    title: 'Three records decide most of it',
    body: (
      <>
        <p>
          A receiving server has one second to judge a message from a domain it may never have seen.
          It starts with three DNS records, because those are the only things about your email that
          cannot be forged.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Record</th>
              <th>What it actually proves</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SPF</td>
              <td>
                This server was allowed to send for that domain. Proves nothing about the message
                itself, and it breaks whenever mail is forwarded.
              </td>
            </tr>
            <tr>
              <td>DKIM</td>
              <td>
                The message carries a signature made with a private key, and the matching public key
                is published in your DNS. Proves the mail is yours and was not altered in transit.
                Survives forwarding.
              </td>
            </tr>
            <tr>
              <td>DMARC</td>
              <td>
                Ties the two above to the domain your reader actually sees, and tells receivers what
                to do when neither passes.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Missing DKIM is the single most common reason a legitimate app&apos;s mail lands in spam.
          Everything else on this page matters less than getting that one record right.
        </p>
      </>
    ),
  },
  {
    id: 'the-records',
    title: 'The records to publish',
    body: (
      <>
        <p>
          Add your domain under <Link to="/domains">Domains</Link> and we generate the exact values
          for you, including a DKIM key pair that only ever exists on our side as a private key.
          They look like this:
        </p>
        <CodeBlock
          label="DNS records"
          lang="plaintext"
        >{`; DKIM — required. The selector is generated per domain.
mail._domainkey.yourdomain.com.   TXT   "v=DKIM1; k=rsa; p=MIIBIjANBgkq..."

; SPF — one record per domain, merged if you already have one
yourdomain.com.                   TXT   "v=spf1 include:<the token we show you> ~all"

; DMARC — start here, tighten later
_dmarc.yourdomain.com.            TXT   "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`}</CodeBlock>
        <p>
          Two rules that catch people out. A domain may have <strong>exactly one SPF record</strong>{' '}
          — if you already send through Google Workspace or anyone else, merge the includes into the
          existing record rather than adding a second one, because two SPF records is a permanent
          error, not a warning. And if your DNS is behind a proxy such as Cloudflare, these TXT
          records must stay DNS-only; proxying applies to HTTP, and a proxied mail hostname simply
          stops answering.
        </p>
      </>
    ),
  },
  {
    id: 'alignment',
    title: 'Alignment: the part nobody explains',
    body: (
      <>
        <p>
          You can have SPF passing, DKIM passing, and DMARC still failing. That is not a bug — DMARC
          does not ask &ldquo;did SPF pass?&rdquo;. It asks{' '}
          <strong>
            did SPF or DKIM pass <em>for the domain in the From: header</em>
          </strong>
          , the one your reader sees.
        </p>
        <p>
          It matters here because of how bounces work. We send with an envelope sender on our own
          bounce domain, so that failures come back to us and get recorded against the message
          instead of vanishing. SPF is checked against that envelope domain, which means SPF is
          authenticated but <em>not aligned</em> with your From domain.
        </p>
        <p>
          So DKIM is what carries DMARC for your mail. That is why the DKIM record is marked
          required in your dashboard and SPF is not: SPF is useful, and some filters weigh it, but
          it is DKIM that makes DMARC pass. Publish both; never skip DKIM.
        </p>
      </>
    ),
  },
  {
    id: 'check',
    title: 'Check what receivers actually see',
    body: (
      <>
        <p>
          Send yourself a real message from your app, then in Gmail open the message menu and choose{' '}
          <strong>Show original</strong>. The top of that page states SPF, DKIM and DMARC as plain
          pass or fail, for that specific message. It is the only opinion that counts, and it takes
          ten seconds.
        </p>
        <p>What you want to see:</p>
        <CodeBlock label="Show original" lang="plaintext">{`SPF:    PASS with IP 62.238.46.237
DKIM:   'PASS' with domain yourdomain.com
DMARC:  'PASS'`}</CodeBlock>
        <p>
          A DKIM line naming a domain that is not yours means the message was signed, but not for
          you — the From address is on a domain you have not verified. A DKIM failure with the right
          domain usually means the DNS record was pasted with a line break or a missing character:
          the key is long, and copying it by hand is where it goes wrong.
        </p>
        <p>
          Beyond that, <code>mail-tester.com</code> scores a single message out of ten and names
          what it dislikes, and the <code>rua=</code> address in your DMARC record collects daily
          XML reports from every large receiver. Point it somewhere you will read.
        </p>
      </>
    ),
  },
  {
    id: 'not-dns',
    title: 'When the records are right and it still goes to spam',
    body: (
      <>
        <p>
          Authentication gets you considered, not accepted. Once the three records pass, what is
          left is reputation and behaviour:
        </p>
        <ul>
          <li>
            <strong>A brand-new domain has no history.</strong> Filters are cautious with a domain
            first seen last week. Volume that ramps gently over two or three weeks reads as a real
            product; a thousand messages on day one reads as a list.
          </li>
          <li>
            <strong>Bounces are the loudest signal.</strong> Repeatedly mailing addresses that do
            not exist is what list-buyers do. Keep hard bounces suppressed — we do it automatically,
            and you should not be re-adding those addresses.
          </li>
          <li>
            <strong>Nobody opening anything.</strong> Transactional mail is normally opened.
            Recipients who never engage, over weeks, pull the whole domain down.
          </li>
          <li>
            <strong>Mixing marketing into transactional mail.</strong> Receipts and password resets
            enjoy high engagement; newsletters do not. Sent from the same domain, the
            newsletter&apos;s complaints follow your password resets into spam. Use a subdomain for
            anything bulk.
          </li>
          <li>
            <strong>The message itself.</strong> A single image with no text, link shorteners, an
            unfamiliar tracking domain, ALL CAPS subjects, or an HTML part with no plain-text
            alternative all cost you.
          </li>
          <li>
            <strong>No unsubscribe on anything bulk.</strong> Since 2024, Gmail and Yahoo require
            one-click unsubscribe and a complaint rate under 0.3% from anyone sending in volume.
            Transactional mail is exempt from the unsubscribe rule — but only if it is genuinely
            transactional.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'recover',
    title: 'Getting out of the spam folder',
    body: (
      <>
        <p>
          Reputation recovers slowly and only through behaviour. In order: fix authentication so
          every message passes DMARC; stop sending to anything that bounced; cut volume back to the
          people who actually use your product; and let two or three weeks of clean sending
          accumulate.
        </p>
        <p>
          In the short term, asking a handful of real users to move the message to their inbox and
          reply to it does more than any header you can add — engagement is the signal filters trust
          most. What does not work is sending more, changing the subject line repeatedly, or moving
          to a fresh domain and starting the same pattern again.
        </p>
      </>
    ),
  },
  {
    id: 'tighten',
    title: 'Tightening DMARC later',
    body: (
      <>
        <p>
          Start at <code>p=none</code>, which asks receivers to report but change nothing. Once your
          reports show your own mail passing consistently for a few weeks — including anything sent
          by other services on the same domain — move to <code>p=quarantine</code>, then{' '}
          <code>p=reject</code>.
        </p>
        <p>
          Going straight to <code>p=reject</code> before reading reports is how a company discovers,
          one Monday morning, that its invoicing tool was sending from the same domain and every
          invoice is now being refused outright.
        </p>
      </>
    ),
  },
  {
    id: 'quick-table',
    title: 'Quick diagnosis',
    body: (
      <table className="doc-table errors">
        <thead>
          <tr>
            <th>Symptom</th>
            <th>Where to look first</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Spam for everyone, from day one</td>
            <td>DKIM. Check &ldquo;Show original&rdquo; says PASS with your domain.</td>
          </tr>
          <tr>
            <td>Inbox at Gmail, spam at Outlook</td>
            <td>
              Normal for a young sending domain — Microsoft is slower to trust. Consistency over
              weeks is the only fix.
            </td>
          </tr>
          <tr>
            <td>Was fine, suddenly spam</td>
            <td>
              Something changed volume or content. Check <Link to="/activity">Activity</Link> for a
              jump in bounces.
            </td>
          </tr>
          <tr>
            <td>DMARC fails, SPF and DKIM pass</td>
            <td>Alignment. The From domain is not the domain that was signed.</td>
          </tr>
          <tr>
            <td>Never arrives at all, not even spam</td>
            <td>
              Not a spam problem — the message was rejected or never sent. Activity shows the
              server&apos;s reply.
            </td>
          </tr>
        </tbody>
      </table>
    ),
  },
];

export function EmailToSpam() {
  return (
    <DocPage
      eyebrow="Guide · 10 min"
      title="Why do my emails go to spam?"
      subtitle="What SPF, DKIM and DMARC each prove, how to read a failure, and the reasons mail still gets filtered once all three pass."
      intro={
        <p>
          Nearly every &ldquo;my app&apos;s email goes to spam&rdquo; case is one of two things: the
          mail is not signed for the domain it claims to be from, or the domain has no sending
          history and is being asked to carry too much too quickly. Both are fixable.
        </p>
      }
      sections={SECTIONS}
      footer={<RelatedGuides path={PATH} />}
    />
  );
}
