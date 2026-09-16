import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { BRAND, Logo } from './bits.js';

/** Header and footer shared by every signed-out page: landing, pricing and auth. */
export function PublicLayout() {
  const { authenticated } = useAuth();

  return (
    <div className="site">
      <header className="site-nav">
        <div className="inner">
          <Logo />
          <nav className="links">
            <NavLink to="/docs">Docs</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
          </nav>
          <div className="row">
            {authenticated ? (
              <Link to="/" className="btn primary sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn ghost sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn primary sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
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
