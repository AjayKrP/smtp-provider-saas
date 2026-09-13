import { Link, NavLink, Outlet } from 'react-router-dom';
import { BRAND, Logo } from './bits.js';

export function PublicLayout() {
  return (
    <div className="site">
      <header className="site-nav">
        <div className="inner">
          <Logo />
          <nav className="links">
            <NavLink to="/pricing">Pricing</NavLink>
          </nav>
          <div className="row">
            <Link to="/login" className="btn ghost sm">
              Sign in
            </Link>
            <Link to="/register" className="btn primary sm">
              Get started
            </Link>
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
            <Link to="/pricing" className="muted">
              Pricing
            </Link>
            <Link to="/login" className="muted">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
