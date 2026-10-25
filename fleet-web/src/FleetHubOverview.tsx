import React from 'react';
import { Link } from 'react-router-dom';

const shortcuts = [
  { to: '/live', title: 'Følg egne biler', text: 'Se flåtens aktivitet på kartet' },
  { to: '/invitasjoner', title: 'Inviter sjåfører', text: 'Invitasjon fra deg, godkjenning hos SNAR' },
  { to: '/dokumenter', title: 'Følg opp dokumenter', text: 'Hold dokumentasjonen oppdatert' },
  { to: '/okonomi', title: 'Se økonomien', text: 'Oversikt over flåtens turer og oppgjør' },
];

export default function FleetHubOverview() {
  return <section aria-labelledby="fleet-hub-heading" style={{ padding: 24 }}>
    <header style={{ marginBottom: 20 }}>
      <h1 id="fleet-hub-heading" style={{ margin: 0 }}>SNAR Hub · Fleet</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>Din arbeidsflate for egne sjåfører, kjøretøy og oppgjør. Kundene bestiller i SNAR-appen.</p>
    </header>
    <nav aria-label="Snarveier for løyvehaver" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {shortcuts.map(item => <Link key={item.to} to={item.to} style={{ flex: '1 1 210px', padding: 20, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', color: 'var(--text)', textDecoration: 'none' }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>{item.title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 0 }}>{item.text}</p>
      </Link>)}
    </nav>
  </section>;
}
