import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { Icon } from './snar-ui';

// Evolve the existing v0 shortcuts while preserving the current Admin routes.
// These are navigation links, not simulated operational metrics.
const shortcuts = [
  { to: '/live', title: 'Følg driften', text: 'Kart, sjåfører og pågående turer', icon: 'map', permission: 'operations' },
  { to: '/actions', title: 'Håndter avvik', text: 'Se hva som trenger oppfølging', icon: 'alert', permission: 'operations' },
  { to: '/drivers', title: 'Administrer sjåfører', text: 'Tilgang, godkjenning og tilgjengelighet', icon: 'users', permission: 'operations' },
  { to: '/payments', title: 'Kontroller oppgjør', text: 'Betalinger og utbetalinger', icon: 'wallet', permission: 'finance' },
  { to: '/support', title: 'Følg opp saker', text: 'Kunde- og sjåførhenvendelser', icon: 'chat', permission: 'support' },
  { to: '/integrations', title: 'Se integrasjoner', text: 'Tjenester og konfigurasjon', icon: 'plug', permission: 'system' },
];

export default function HubOverview() {
  const { user } = useAuth();
  const visible = shortcuts.filter(item => user?.role === 'superadmin' ||
    user?.permissions == null || user.permissions.includes(item.permission));
  return <section className="hub-overview" aria-labelledby="hub-shortcuts-heading">
    <div className="hub-overview-head">
      <h2 id="hub-shortcuts-heading">Din arbeidsflate</h2>
      <p>Gå direkte til oppgavene du følger opp.</p>
    </div>
    <nav className="hub-shortcuts" aria-label="Snarveier i Operations Hub">
      {visible.map(item => <Link key={item.to} to={item.to} className="hub-shortcut">
        <span className="hub-shortcut-icon"><Icon name={item.icon} size={20} /></span>
        <span className="hub-shortcut-copy"><strong>{item.title}</strong><span>{item.text}</span></span>
        <Icon name="arrow" size={16} />
      </Link>)}
    </nav>
  </section>;
}
