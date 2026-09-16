import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePublicConfig } from '../api/hooks.js';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared layout for Terms, Privacy and any future policy page. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  const { hash } = useLocation();
  // Deep links like /privacy#retention: the section only exists after this render, so
  // the browser's own jump-to-anchor has already happened (and missed).
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <section className="section legal">
      <header className="legal-head">
        <span className="eyebrow">Legal</span>
        <h1>{title}</h1>
        <p className="muted">Last updated {updated}</p>
        <div className="legal-intro">{intro}</div>
      </header>

      <div className="legal-body">
        <nav className="legal-toc" aria-label="Contents">
          <p className="small muted">On this page</p>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="legal-content">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2>
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          <p className="legal-foot muted small">
            Questions about this page? Email <Mail />. See also our{' '}
            {title === 'Terms of Service' ? (
              <Link to="/privacy">Privacy Policy</Link>
            ) : (
              <Link to="/terms">Terms of Service</Link>
            )}
            .
          </p>
        </article>
      </div>
    </section>
  );
}

/** The support address, straight from the server's MAIL_FROM. */
export function Mail({ address }: { address?: string } = {}) {
  const email = address ?? usePublicConfig().data?.supportEmail ?? '';
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>our support address</>;
}
