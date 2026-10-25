import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth';
import { Icon } from './snar-ui';

const shortcuts = [
  { to: '/live', title: 'Følg driften', text: 'Kart, bilstatus og pågående turer', icon: 'map', permission: 'operations' },
  { to: '/actions', title: 'Håndter avvik', text: 'Oppgaver som krever oppfølging', icon: 'alert', permission: 'operations' },
  { to: '/payments', title: 'Kontroller oppgjør', text: 'Betalinger og utbetalinger', icon: 'wallet', permission: 'finance' },
  { to: '/promo-codes', title: 'Administrer kampanjer', text: 'Koder, kundekreditt og forbruk', icon: 'tag', permission: 'finance' },
];

export default function HubOverview() {
  const { user } = useAuth();
  return <section aria-labelledby="hub-heading" style={{ marginBottom: 24 }}>
    <header style={{ marginBottom: 20 }}>
      <h1 id="hub-heading" style={{ margin: 0 }}>SNAR Hub</h1>
      <p className="dim">Administrasjon av en appbasert transporttjeneste. Alle bestillinger opprettes i kundeappen.</p>
    </header>
    <nav aria-label="Snarveier i SNAR Hub" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {shortcuts.filter(item => user?.role === 'superadmin' || user?.permissions == null || user.permissions.includes(item.permission)).map(item =>
        <Link key={item.to} to={item.to} className="card" style={{ flex: '1 1 210px', padding: 20, border: '1px solid var(--line)', borderRadius: 12 }}>
          <Icon name={item.icon} size={24} />
          <h2 style={{ fontSize: 16 }}>{item.title}</h2>
          <p className="dim" style={{ fontSize: 14, marginBottom: 0 }}>{item.text}</p>
        </Link>)}
    </nav>
  </section>;
}
