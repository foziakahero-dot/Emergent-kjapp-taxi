import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { Loader } from './ui';
import Login from './Login';
import FleetApplications from './FleetApplications';
import {
  Dashboard, Live, Trips, Drivers, Customers, Fleets, Vehicles, Documents, Finance, Support, Audit, Settings,
} from './pages';

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  live: <><circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8m12.8-12.8a9 9 0 0 1 0 12.8" /></>,
  trips: <><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></>,
  drivers: <><circle cx="12" cy="7" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3H5Z" /></>,
  customers: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm14-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1h-3" /></>,
  applications: <><path d="M8 3h8l4 4v14H4V3h4Zm8 0v5h4M8 12h8M8 16h8" /></>,
  fleets: <><rect x="3" y="10" width="18" height="8" rx="2" /><path d="m6 10 2-4h8l2 4M7 18v2m10-2v2M7 14h.01M17 14h.01" /></>,
  vehicles: <><path d="m5 15 2-6h10l2 6M4 15h16v4H4v-4Zm3 4v2m10-2v2M7 16h.01M17 16h.01" /></>,
  finance: <><path d="M4 20V9m5 11V4m5 16v-7m5 7V7M2 20h20" /></>,
  support: <><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v5h4v-5H4Zm16 0h2v5h-4v-5h2Zm0 5a4 4 0 0 1-4 4h-4" /></>,
  documents: <><path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7M9 16h7" /></>,
  audit: <><path d="M12 3 4 7v5c0 5 3 8 8 9 5-1 8-4 8-9V7l-8-4Zm-3 9 2 2 4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m10 2-.5 2.1-2 1L5.5 4 4 5.5l1.1 2-1 2L2 10v4l2.1.5 1 2-1.1 2L5.5 20l2-1.1 2 1L10 22h4l.5-2.1 2-1 2 1.1 1.5-1.5-1.1-2 1-2L22 14v-4l-2.1-.5-1-2 1.1-2L18.5 4l-2 1.1-2-1L14 2h-4Z" /></>,
};
const NavIcon = ({ name }: { name: string }) => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;

const NAV = [
  { group: 'Oversikt', items: [
    { to: '/', label: 'Dashbord', ic: 'dashboard', end: true },
    { to: '/live', label: 'Live drift', ic: 'live' },
  ]},
  { group: 'Drift', items: [
    { to: '/trips', label: 'Turer', ic: 'trips' },
    { to: '/drivers', label: 'Sjåfører', ic: 'drivers' },
    { to: '/customers', label: 'Kunder', ic: 'customers' },
    { to: '/fleet-applications', label: 'Løyvesøknader', ic: 'applications', superadminOnly: true },
    { to: '/fleets', label: 'Løyvehavere', ic: 'fleets' },
    { to: '/vehicles', label: 'Kjøretøy', ic: 'vehicles' },
  ]},
  { group: 'Økonomi', items: [
    { to: '/finance', label: 'Økonomi', ic: 'finance' },
  ]},
  { group: 'Support & compliance', items: [
    { to: '/support', label: 'Support', ic: 'support' },
    { to: '/documents', label: 'Dokumenter', ic: 'documents' },
  ]},
  { group: 'System', items: [
    { to: '/audit', label: 'Audit-logg', ic: 'audit' },
    { to: '/settings', label: 'Innstillinger', ic: 'settings' },
  ]},
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const t = useRef<any>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 2) { setRes(null); return; }
    t.current = setTimeout(() => {
      api.search(q.trim()).then((d) => { setRes(d); setOpen(true); }).catch(() => setRes(null));
    }, 250);
  }, [q]);

  const go = (path: string) => { setOpen(false); setQ(''); nav(path); };

  return (
    <div className="search" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <input aria-label="Søk turer, sjåfører, kunder og løyvehavere" placeholder="Søk turer, sjåfører, kunder, løyvehavere…" value={q}
        onFocus={() => res && setOpen(true)} onChange={(e) => setQ(e.target.value)} />
      {open && res && (
        <div className="search-pop">
          {(res.trips?.length || res.drivers?.length || res.customers?.length || res.fleets?.length) ? (
            <>
              {res.trips?.length ? <div className="search-cat">Turer</div> : null}
              {res.trips?.map((x: any) => (
                <button type="button" key={x.trip_id} className="search-res" onClick={() => go('/trips?q=' + x.trip_id)}>
                  <span className="mono dim">{String(x.trip_id).slice(0, 6)}</span><span>{x.dropoff_address}</span>
                </button>
              ))}
              {res.drivers?.length ? <div className="search-cat">Sjåfører</div> : null}
              {res.drivers?.map((x: any) => (
                <button type="button" key={x.id} className="search-res" onClick={() => go('/drivers?q=' + encodeURIComponent(x.name || x.email))}>
                  <span>{x.name}</span><span className="dim">{x.plate || x.email}</span>
                </button>
              ))}
              {res.customers?.length ? <div className="search-cat">Kunder</div> : null}
              {res.customers?.map((x: any) => (
                <button type="button" key={x.id} className="search-res" onClick={() => go('/customers?q=' + encodeURIComponent(x.name || x.email))}>
                  <span>{x.name}</span><span className="dim">{x.phone || x.email}</span>
                </button>
              ))}
              {res.fleets?.length ? <div className="search-cat">Løyvehavere</div> : null}
              {res.fleets?.map((x: any) => (
                <button type="button" key={x.id} className="search-res" onClick={() => go('/fleets?q=' + encodeURIComponent(x.name))}>
                  <span>{x.name}</span><span className="dim">{x.org_number}</span>
                </button>
              ))}
            </>
          ) : <div className="search-res dim">Ingen treff</div>}
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState<any>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  useEffect(() => { api.overview().then(setCounts).catch(() => {}); }, []);
  const initials = (user?.fullName || user?.email || 'A').slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      {menuOpen && <button className="nav-backdrop" aria-label="Lukk meny" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} id="admin-navigation" aria-label="Hovedmeny">
        <div className="brand"><div className="brand-mark">K</div><div className="brand-name">KJAPP</div></div>
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-title">{g.group}</div>
            {g.items
              .filter((it: any) => !it.superadminOnly || user?.role === 'superadmin')
              .map((it: any) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-ic"><NavIcon name={it.ic} /></span>{it.label}
                {it.to === '/drivers' && counts?.drivers?.pending ? <span className="nav-badge">{counts.drivers.pending}</span> : null}
                {it.to === '/fleet-applications' && counts?.fleets?.pending_applications ? <span className="nav-badge">{counts.fleets.pending_applications}</span> : null}
                {it.to === '/support' && counts?.support?.open ? <span className="nav-badge">{counts.support.open}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, color: 'var(--muted)', fontSize: 11 }}>v1.0 · {user?.role}</div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Lukk meny' : 'Åpne meny'} aria-controls="admin-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? '✕' : '☰'}
          </button>
          <GlobalSearch />
          <div className="who">
            <span className="who-email">{user?.email}</span>
            <div className="avatar">{initials}</div>
            <button className="btn sm ghost" onClick={logout}>Logg ut</button>
          </div>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/live" element={<Live />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/fleet-applications" element={<FleetApplications />} />
            <Route path="/fleets" element={<Fleets />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/support" element={<Support />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <div className="auth-wrap"><Loader /></div>;
  if (!user) return <Login />;
  return <Shell />;
}