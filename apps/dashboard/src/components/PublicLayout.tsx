import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { BRAND, Icon, Logo } from './bits.js';

const LINKS = [
  ['/docs', 'Docs'],
  ['/pricing', 'Pricing'],
] as const;

/** Header and footer shared by every signed-out page: landing, pricing, docs and auth. */
export function PublicLayout() {
  const { authenticated } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Never leave the menu open across a navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="site">
      <header className="site-nav">
        <div className="inner">
          <Logo />
          <nav className="links">
            {LINKS.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="row">
            {authenticated ? (
              <Link to="/" className="btn primary sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn ghost sm signin">
                  Sign in
                </Link>
                <Link to="/register" className="btn primary sm">
                  Get started
                </Link>
              </>
            )}
            {/* Shown only once the inline links no longer fit; see styles.css. */}
            <button
              type="button"
              className="btn sm menu-toggle"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="menu-panel">
            {LINKS.map(([to, label]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
            {!authenticated && <Link to="/login">Sign in</Link>}
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-foot">
        <div className="inner">
          <span>
            © {new Date().getFullYear()} {BRAND}
          </span>
          <span className="row">
            <Link to="/docs" className="muted">
              Docs
            </Link>
            <Link to="/pricing" className="muted">
              Pricing
            </Link>
            <Link to="/terms" className="muted">
              Terms
            </Link>
            <Link to="/privacy" className="muted">
              Privacy
            </Link>
            {authenticated ? (
              <Link to="/" className="muted">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="muted">
                Sign in
              </Link>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
