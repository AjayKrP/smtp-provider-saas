import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../api/hooks.js';
import { CodeBlock } from '../../components/CodeBlock.js';
import { DocPage, type DocSection } from '../../components/DocPage.js';
import { RelatedGuides } from './GuidesIndex.js';

const PATH = '/guides/supabase-smtp-settings';

function sectionsFor(host: string): DocSection[] {
  return [
    {
      id: 'settings',
      title: 'The settings, in full',
      body: (
        <>
          <p>
            Supabase asks for six values. Five of them are the same for everyone; only the sender
            address is yours.
          </p>
          <table className="doc-table">
            <tbody>
              <tr>
                <td>Sender email</td>
                <td>
                  <code>noreply@yourdomain.com</code> — must be on a domain you have verified
                </td>
              </tr>
              <tr>
                <td>Sender name</td>
                <td>whatever your users should see, e.g. your product name</td>
              </tr>
              <tr>
                <td>Host</td>
                <td>
                  <code>{host}</code>
                </td>
              </tr>
              <tr>
                <td>Port</td>
                <td>
                  <code>587</code>
                </td>
              </tr>
              <tr>
                <td>Username</td>
                <td>
                  from <Link to="/credentials">SMTP credentials</Link> in your dashboard
                </td>
              </tr>
              <tr>
                <td>Password</td>
                <td>shown once, when you create that credential</td>
              </tr>
            </tbody>
          </table>
          <p>
            Use port <code>587</code>. Port <code>465</code> works too, but Supabase expects
            STARTTLS on 587 and that is the combination least likely to surprise you.
          </p>
        </>
      ),
    },
    {
      id: 'where',
      title: 'Where the fields live',
      body: (
        <>
          <p>
            In the Supabase dashboard, open your project and go to{' '}
            <strong>Authentication → Emails → SMTP Settings</strong>, then turn on{' '}
            <strong>Enable Custom SMTP</strong>. On older projects the same panel sits under{' '}
            <strong>Project Settings → Authentication</strong>; Supabase has moved it more than
            once, so search the settings for &ldquo;SMTP&rdquo; if neither path matches what you
            see.
          </p>
          <p>
            Fill in the six values, save, and Supabase will start routing every auth email —
            confirmation, magic link, password reset, email change — through your credential instead
            of its own sender.
          </p>
        </>
      ),
    },
    {
      id: 'why-replace',
      title: 'Why the built-in mailer is not enough',
      body: (
        <>
          <p>
            Supabase ships a shared email service so that a brand-new project can send something on
            day one. It is deliberately throttled to a couple of messages an hour, it only delivers
            to members of your Supabase organisation, and Supabase itself says it is not for
            production use.
          </p>
          <p>
            That is why the first real signup on a new project appears to do nothing: the user is
            created, the confirmation email is rate-limited away, and nothing in the UI tells you.
            Custom SMTP is not an optimisation here — it is the step that makes signup work at all.
          </p>
        </>
      ),
    },
    {
      id: 'rate-limit',
      title: 'Raise the auth rate limit as well',
      body: (
        <>
          <p>
            Enabling SMTP does not by itself lift Supabase&apos;s own cap on auth emails. Go to{' '}
            <strong>Authentication → Rate Limits</strong> and raise{' '}
            <strong>Rate limit for sending emails</strong> to something your traffic justifies.
          </p>
          <p>
            Leaving it low is the most common reason people configure SMTP correctly and still see
            missing confirmation emails at the second or third signup of the hour. Our own monthly
            quota is separate and shown in your dashboard — the two limits are enforced in different
            places and you need both to be generous enough.
          </p>
        </>
      ),
    },
    {
      id: 'sender-domain',
      title: 'The sender address rule',
      body: (
        <>
          <p>
            The sender email you give Supabase becomes the <code>From:</code> header on every auth
            email, and we will only send for a domain you have verified in{' '}
            <Link to="/domains">Domains</Link>. If the two disagree, the message is rejected at SMTP
            time with a clear error rather than delivered unsigned.
          </p>
          <p>
            So: add your domain, paste the DKIM and SPF records we generate into your DNS, wait for
            verification, then set the Supabase sender to an address on that same domain. A
            <code> noreply@</code> or <code>auth@</code> mailbox does not have to exist — it only
            has to be on the verified domain.
          </p>
        </>
      ),
    },
    {
      id: 'local',
      title: 'Local development and self-hosted',
      body: (
        <>
          <p>
            Running Supabase locally through the CLI, the same settings go in{' '}
            <code>supabase/config.toml</code> rather than the dashboard:
          </p>
          <CodeBlock label="supabase/config.toml" lang="ini">{`[auth.email.smtp]
enabled = true
host = "${host}"
port = 587
user = "env(SMTP_USER)"
pass = "env(SMTP_PASS)"
admin_email = "noreply@yourdomain.com"
sender_name = "Your App"`}</CodeBlock>
          <p>
            Most people leave local development on Inbucket (the mail catcher the CLI starts for
            you) and only point at a real server from a deployed environment. Both are fine — just
            create a separate credential for each, so revoking one never touches the other.
          </p>
        </>
      ),
    },
    {
      id: 'verify',
      title: 'Check that it worked',
      body: (
        <>
          <p>
            Trigger a password reset for your own address from your app, then open{' '}
            <Link to="/activity">Activity</Link>. Within a second or two you should see the message,
            its recipient, and what the receiving server replied — the actual SMTP conversation, not
            a &ldquo;sent&rdquo; flag.
          </p>
          <p>
            If nothing appears in Activity at all, the message never reached us: the failure is on
            the Supabase side, and its own auth logs (Logs → Auth) will name it.
          </p>
        </>
      ),
    },
    {
      id: 'errors',
      title: 'When it does not work',
      body: (
        <table className="doc-table errors">
          <thead>
            <tr>
              <th>What you see</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>535</code> authentication failed
              </td>
              <td>
                Wrong username or password. The password is shown once at creation — if it was not
                saved, delete the credential and make a new one.
              </td>
            </tr>
            <tr>
              <td>
                <code>550</code> not a verified sending domain
              </td>
              <td>
                The Supabase sender address is on a domain that is not verified here. Check{' '}
                <Link to="/domains">Domains</Link> shows DKIM as verified.
              </td>
            </tr>
            <tr>
              <td>Nothing in Activity, no error</td>
              <td>
                Supabase never attempted a send. Almost always its own auth rate limit, or custom
                SMTP left disabled after saving.
              </td>
            </tr>
            <tr>
              <td>Connection timeout on save</td>
              <td>
                Something between Supabase and port 587 is blocked. Re-check the host spelling
                before anything else.
              </td>
            </tr>
            <tr>
              <td>Delivered, but in spam</td>
              <td>
                An authentication or reputation problem, not a Supabase one. See{' '}
                <Link to="/guides/why-emails-go-to-spam">why emails go to spam</Link>.
              </td>
            </tr>
          </tbody>
        </table>
      ),
    },
  ];
}

export function SupabaseSmtp() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';

  return (
    <DocPage
      eyebrow="Guide · 5 min"
      title="SMTP settings for Supabase Auth"
      subtitle="Replace Supabase's built-in mailer with your own SMTP credential, so confirmation and password-reset emails actually arrive."
      intro={
        <p>
          Supabase&apos;s shared email service is capped at a couple of messages an hour and only
          delivers to your own team — which is why signup emails quietly stop the moment you show
          the app to someone else. Custom SMTP takes about five minutes to set up.
        </p>
      }
      sections={sectionsFor(host)}
      footer={<RelatedGuides path={PATH} />}
    />
  );
}
