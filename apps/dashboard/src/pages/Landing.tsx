import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/bits.js';
import { PricingSection } from './Pricing.js';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'zap',
    title: 'Drop-in SMTP',
    body: 'Works with any language, framework or mail client. Swap four settings and you are sending.',
  },
  {
    icon: 'shield',
    title: 'Authenticated by default',
    body: 'Every message is DKIM-signed for your verified domain, with SPF alignment and TLS in transit.',
  },
  {
    icon: 'chart',
    title: 'See every delivery',
    body: 'Follow each message from acceptance to the recipient’s mail server, including bounces and retries.',
  },
];

export function Landing() {
  const host = window.location.hostname;
  return (
    <>
      <section className="section hero">
        <div className="pill">
          <span className="badge ok">Live</span>
          Direct-to-MX delivery with automatic retries
        </div>
        <h1>
          Email delivery for your app, <span className="grad">minus the hassle.</span>
        </h1>
        <p className="lede">
          A reliable SMTP relay with domain authentication, delivery tracking and simple monthly
          plans.
        </p>
        <div className="row cta">
          <Link to="/register" className="btn primary lg">
            Start sending free <Icon name="arrow" />
          </Link>
          <a href="#pricing" className="btn lg">
            View pricing
          </a>
        </div>

        <div className="terminal">
          <div className="bar">
            <i />
            <i />
            <i />
            <span>.env</span>
          </div>
          <pre>
            <span className="k">SMTP_HOST</span>=<span className="v">{host}</span>
            {'\n'}
            <span className="k">SMTP_PORT</span>=<span className="v">587</span>
            {'\n'}
            <span className="k">SMTP_USER</span>=<span className="v">your-username</span>
            {'\n'}
            <span className="k">SMTP_PASS</span>=<span className="v">••••••••••••</span>
          </pre>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="features">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="ico">
                <Icon name={f.icon} size={18} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <PricingSection id="pricing" />
    </>
  );
}
