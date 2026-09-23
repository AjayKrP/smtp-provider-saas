import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../api/hooks.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { PROMPTS } from '../content/prompt.js';

/**
 * A linkable home for the paste-in prompt.
 *
 * It exists because of how people actually share this: someone answers "how do I add
 * email to my Lovable app" in a Discord thread and needs one URL to paste. A tab on the
 * home page cannot be that URL.
 */
export function Prompt() {
  const host = usePublicConfig().data?.smtpHost ?? 'smtp.email4vibecoder.com';
  const [active, setActive] = useState(PROMPTS[0]!.id);
  const variant = PROMPTS.find((p) => p.id === active) ?? PROMPTS[0]!;

  return (
    <section className="section doc">
      <header className="doc-head">
        <span className="eyebrow">AI prompt</span>
        <h1>Let your AI assistant add email for you</h1>
        <p className="muted">
          Copy one of these into Cursor, Claude Code, Lovable, Bolt or Replit. It carries the
          settings and, more importantly, the constraints an assistant would otherwise have to guess
          — which is what stops it writing email code that never sends.
        </p>
      </header>

      <div className="prompt-page">
        <div className="tabs" role="tablist" aria-label="Prompt variants">
          {PROMPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`prompt-tab-${p.id}`}
              aria-selected={p.id === active}
              aria-controls={`prompt-panel-${p.id}`}
              className={`btn sm${p.id === active ? ' primary' : ' ghost'}`}
              onClick={() => setActive(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`prompt-panel-${variant.id}`}
          aria-labelledby={`prompt-tab-${variant.id}`}
        >
          <p className="muted small">{variant.audience}</p>
          <CodeBlock label={`${variant.label} prompt`} lang="plaintext">
            {variant.text(host)}
          </CodeBlock>
        </div>

        <div className="card">
          <h2>Before you paste it</h2>
          <p className="muted">
            The prompt refers to a username, a password and a verified domain. All three come from
            your dashboard, and the free plan gives you 500 emails a month without a card:
          </p>
          <ol className="steps-plain">
            <li>
              <Link to="/register">Create an account</Link> and add your domain under Domains.
            </li>
            <li>Paste the DKIM record we generate into your DNS and wait for it to verify.</li>
            <li>
              Create an SMTP credential — the password is shown once, so put it straight into your
              environment variables.
            </li>
          </ol>
          <p className="muted small">
            Full setup instructions per framework are in the{' '}
            <Link to="/docs">integration guide</Link>, and the per-tool gotchas are in the{' '}
            <Link to="/guides">guides</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
