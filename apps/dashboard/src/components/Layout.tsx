import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { useMe } from '../api/hooks.js';

const links = [
  ['/', 'Overview'],
  ['/domains', 'Domains'],
  ['/credentials', 'SMTP Credentials'],
  ['/activity', 'Activity'],
  ['/billing', 'Billing'],
] as const;

export function Layout() {
  const { logout } = useAuth();
  const { data: me } = useMe();

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">SMTP SaaS</div>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
        <div className="spacer" />
        {me && (
          <div className="muted" style={{ padding: '8px 12px', fontSize: 12 }}>
            {me.email}
            <br />
            {me.organization?.name}
          </div>
        )}
        <button onClick={() => void logout()}>Sign out</button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
