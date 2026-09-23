import { Link } from 'react-router-dom';
import { GUIDE_GROUPS, GUIDES, relatedGuides, type GuideEntry } from '../../content/guides.js';
import { Icon, type IconName } from '../../components/bits.js';

const GROUP_ICON: Record<GuideEntry['group'], IconName> = {
  integration: 'code',
  deliverability: 'shield',
  comparison: 'chart',
};

function GuideCard({ guide }: { guide: GuideEntry }) {
  return (
    <Link to={guide.path} className="guide-card">
      <span className="ico">
        <Icon name={GROUP_ICON[guide.group]} />
      </span>
      <h3>{guide.label}</h3>
      <p>{guide.description}</p>
      <span className="small muted">{guide.minutes} min read</span>
    </Link>
  );
}

/**
 * The hub every guide links back to. It exists as much for crawlers as for readers:
 * without it each guide is an orphan reachable only from the footer.
 */
export function GuidesIndex() {
  return (
    <section className="section doc">
      <header className="doc-head">
        <span className="eyebrow">Guides</span>
        <h1>Email guides for people shipping apps</h1>
        <p className="muted">
          Short, specific write-ups for the things that actually block a first send: the settings a
          given tool expects, why a message landed in spam, and how we compare to the providers you
          already know.
        </p>
      </header>

      {GUIDE_GROUPS.map((group) => {
        const guides = GUIDES.filter((g) => g.group === group.id);
        if (guides.length === 0) return null;
        return (
          <div key={group.id} className="guide-group">
            <div className="section-head">
              <h2>{group.title}</h2>
              <p>{group.blurb}</p>
            </div>
            <div className="guide-grid">
              {guides.map((guide) => (
                <GuideCard key={guide.path} guide={guide} />
              ))}
            </div>
          </div>
        );
      })}

      <p className="doc-foot muted small">
        Looking for copy-paste code for a specific language instead? That lives in the{' '}
        <Link to="/docs">integration guide</Link>.
      </p>
    </section>
  );
}

/** Foot of every guide: keeps a reader (and a crawler) moving to the next page. */
export function RelatedGuides({ path }: { path: string }) {
  const related = relatedGuides(path);
  if (related.length === 0) return null;
  return (
    <nav className="related" aria-label="Related guides">
      <p className="small muted">Read next</p>
      <ul>
        {related.map((guide) => (
          <li key={guide.path}>
            <Link to={guide.path}>{guide.label}</Link>
          </li>
        ))}
        <li>
          <Link to="/guides">All guides</Link>
        </li>
      </ul>
    </nav>
  );
}
