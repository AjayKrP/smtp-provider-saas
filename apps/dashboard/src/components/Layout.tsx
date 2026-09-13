import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { useMe } from '../api/hooks.js';
import { Icon, Logo, type IconName } from './bits.js';

const links: [string, string, IconName][] = [
  ['/', 'Overview', 'dashboard'],
  ['/domains', 'Domains', 'globe'],
  ['/credentials', 'SMTP credentials', 'key'],
  ['/activity', 'Activity', 'activity'],
  ['/billing', 'Billing', 'card'],
];

export function Layout() {
  const { logout } = useAuth();
  const { data: me } = useMe();
  const initial = (me?.name || me?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
        </div>
        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}>
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="account">
          <div className="avatar">{initial}</div>
          <div className="who">
            <div>{me?.name || me?.email}</div>
            <div className="muted small">{me?.organization?.name}</div>
          </div>
          <button
            className="icon-btn"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
