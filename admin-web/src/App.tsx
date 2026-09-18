import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { Loader } from './ui';
import Login from './Login';
import FleetApplications from './FleetApplications';
import {
  Dashboard, Live, Trips, Drivers, Customers, Fleets, Vehicles, Documents, Finance, Support, Audit, Settings,
} from './pages';

const NAV = [
  { group: 'Oversikt', items: [
    { to: '/', label: 'Dashbord', ic: '▤', end: true },
    { to: '/live', label: 'Live drift', ic: '◉' },
  ]},
  { group: 'Drift', items: [
    { to: '/trips', label: 'Turer', ic: '⇄' },
    { to: '/drivers', label: 'Sjåfører', ic: '☗' },
    { to: '/customers', label: 'Kunder', ic: '☺' },
    { to: '/fleet-applications', label: 'Løyvesøknader', ic: '◇', superadminOnly: true },
    { to: '/fleets', label: 'Løyvehavere', ic: '⌂' },
    { to: '/vehicles', label: 'Kjøretøy', ic: '⛚' },
  ]},
  { group: 'Økonomi', items: [
    { to: '/finance', label: 'Økonomi', ic: '≣' },
  ]},
  { group: 'Support & compliance', items: [
    { to: '/support', label: 'Support', ic: '✆' },
    { to: '/documents', label: 'Dokumenter', ic: '❑' },
  ]},
  { group: 'System', items: [
    { to: '/audit', label: 'Audit-logg', ic: '⌘' },
    { to: '/settings', label: 'Innstillinger', ic: '⚙' },
  ]},
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const t = useRef<any>(null);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (q.trim().length < 2) { setRes(null); setError(''); setOpen(false); return; }
    t.current = setTimeout(() => {
      api.search(q.trim()).then((d) => { setRes(d); setError(''); setOpen(true); })
        .catch(() => { setRes(null); setError('Søket er midlertidig utilgjengelig. Bruk listene i menyen.'); setOpen(true); });
    }, 250);
    return () => clearTimeout(t.current);
  }, [q]);

  const go = (path: string) => { setOpen(false); setQ(''); nav(path); };

  return (
    <div className="search" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <input placeholder="Søk turer, sjåfører, kunder, løyvehavere…" value={q}
        onFocus={() => (res || error) && setOpen(true)} onChange={(e) => setQ(e.target.value)} />
      {open && (res || error) && (
        <div className="search-pop">
          {error ? <div className="search-res dim" role="alert">{error}</div> :
          (res?.trips?.length || res?.drivers?.length || res?.customers?.length || res?.fleets?.length) ? (
            <>
              {res.trips?.length ? <div className="search-cat">Turer</div> : null}
              {res.trips?.map((x: any) => (
                <div key={x.trip_id} className="search-res" onMouseDown={() => go('/trips?q=' + x.trip_id)}>
                  <span className="mono dim">{String(x.trip_id).slice(0, 6)}</span><span>{x.dropoff_address}</span>
                </div>
              ))}
              {res.drivers?.length ? <div className="search-cat">Sjåfører</div> : null}
              {res.drivers?.map((x: any) => (
                <div key={x.id} className="search-res" onMouseDown={() => go('/drivers?q=' + encodeURIComponent(x.name || x.email))}>
                  <span>{x.name}</span><span className="dim">{x.plate || x.email}</span>
                </div>
              ))}
              {res.customers?.length ? <div className="search-cat">Kunder</div> : null}
              {res.customers?.map((x: any) => (
                <div key={x.id} className="search-res" onMouseDown={() => go('/customers?q=' + encodeURIComponent(x.name || x.email))}>
                  <span>{x.name}</span><span className="dim">{x.phone || x.email}</span>
                </div>
              ))}
              {res.fleets?.length ? <div className="search-cat">Løyvehavere</div> : null}
              {res.fleets?.map((x: any) => (
                <div key={x.id} className="search-res" onMouseDown={() => go('/fleets?q=' + encodeURIComponent(x.name))}>
                  <span>{x.name}</span><span className="dim">{x.org_number}</span>
                </div>
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
  useEffect(() => { api.overview().then(setCounts).catch(() => {}); }, []);
  const initials = (user?.fullName || user?.email || 'A').slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">K</div><div className="brand-name">KJAPP</div></div>
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-title">{g.group}</div>
            {g.items
              .filter((it: any) => !it.superadminOnly || user?.role === 'superadmin')
              .map((it: any) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-ic">{it.ic}</span>{it.label}
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