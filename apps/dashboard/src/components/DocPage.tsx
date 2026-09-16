import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicConfig } from '../api/hooks.js';

export interface DocSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * Long-form page with a sticky contents sidebar: integration docs, terms, privacy.
 * Every section gets a real heading and an anchor, which is what both readers and
 * search engines need to navigate a long page.
 */
export function DocPage({
  eyebrow,
  title,
  subtitle,
  intro,
  sections,
  numbered = false,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  intro?: ReactNode;
  sections: DocSection[];
  /** Legal pages cite clause numbers; docs read better without them. */
  numbered?: boolean;
  footer?: ReactNode;
}) {
  const { hash } = useLocation();
  // Deep links like /docs#django: the section only exists after this render, so the
  // browser's own jump-to-anchor has already happened (and missed).
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <section className="section doc">
      <header className="doc-head">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {intro && <div className="doc-intro">{intro}</div>}
      </header>

      <div className="doc-body">
        <nav className="doc-toc" aria-label="Contents">
          <p className="small muted">On this page</p>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="doc-content">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2>
                {numbered ? `${i + 1}. ` : ''}
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          {footer && <p className="doc-foot muted small">{footer}</p>}
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
