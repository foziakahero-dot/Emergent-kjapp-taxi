import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { Loader } from './ui';
import Login from './Login';
import FleetApplications from './FleetApplications';
import IdentityVerifications from './IdentityVerifications';
import {
  Dashboard, Live, Trips, Drivers, Customers, Vehicles, Documents, Finance, Support, Audit, Settings,
} from './pages';
import {
  FleetManagement, PaymentsPayouts, Communications, ActionCenter, SystemIntegrations, AdminRoles,
} from './controlCenter';

const NAV = [
  { group: 'Oversikt', items: [
    { to: '/', label: 'Dashbord', ic: '▤', end: true, perm: 'operations' },
    { to: '/live', label: 'Live drift', ic: '◉', perm: 'operations' },
    { to: '/actions', label: 'Krever handling', ic: '!', perm: 'operations' },
  ]},
  { group: 'Drift', items: [
    { to: '/trips', label: 'Turer', ic: '⇄', perm: 'operations' },
    { to: '/drivers', label: 'Sjåfører', ic: '☗', perm: 'operations' },
    { to: '/identity-verifications', label: 'Selfie ID', ic: '◉', perm: 'operations' },
    { to: '/customers', label: 'Kunder', ic: '☺', perm: 'operations' },
    { to: '/fleet-applications', label: 'Løyvesøknader', ic: '◇', superadminOnly: true },
    { to: '/fleets', label: 'Løyvehavere', ic: '⌂', perm: 'operations' },
    { to: '/vehicles', label: 'Kjøretøy', ic: '⛚', perm: 'operations' },
  ]},
  { group: 'Økonomi', items: [
    { to: '/finance', label: 'Økonomi', ic: '≣', perm: 'finance' },
    { to: '/payments', label: 'Betaling & oppgjør', ic: '₭', perm: 'finance' },
    { to: '/pricing', label: 'Prissetting', ic: '◈', perm: 'system' },
  ]},
  { group: 'Kommunikasjon & support', items: [
    { to: '/communications', label: 'Kommunikasjon', ic: '✉', perm: 'communications' },
    { to: '/support', label: 'Support', ic: '✆', perm: 'support' },
    { to: '/documents', label: 'Dokumenter', ic: '❑', perm: 'operations' },
  ]},
  { group: 'System', items: [
    { to: '/integrations', label: 'Integrasjoner', ic: '◎', perm: 'system' },
    { to: '/admins', label: 'Administratorer', ic: '♙', superadminOnly: true },
    { to: '/audit', label: 'Audit-logg', ic: '⌘', perm: 'system' },
    { to: '/settings', label: 'Innstillinger', ic: '⚙', perm: 'system' },
  ]},
]

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
  const can = (perm: string) => user?.role === 'superadmin' || user?.permissions == null || user.permissions.includes(perm);
  const gate = (perm: string, node: React.ReactNode, superadminOnly = false) => {
    const allowed = superadminOnly ? user?.role === 'superadmin' : can(perm);
    return allowed ? node : <div className="error-banner" role="alert">Du har ikke tilgang til denne delen av administrasjonspanelet.</div>;
  };
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
              .filter((it: any) => {
                if (it.superadminOnly && user?.role !== 'superadmin') return false;
                if (!it.perm || user?.role === 'superadmin') return true;
                if (user?.permissions == null) return true; // legacy admin keeps existing access
                return user.permissions.includes(it.perm);
              })
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
        <div style={{ padding: 14, color: 'var(--muted)', fontSize: 11 }}>v1.1 · BETA OPS · {user?.role}</div>
      </aside>

      <div className="main">
        <div className="topbar">
          {can('operations') ? <GlobalSearch /> : <div />}
          <div className="who">
            <span className="who-email">{user?.email}</span>
            <div className="avatar">{initials}</div>
            <button className="btn sm ghost" onClick={logout}>Logg ut</button>
          </div>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={gate('operations', <Dashboard />)} />
            <Route path="/live" element={gate('operations', <Live />)} />
            <Route path="/trips" element={gate('operations', <Trips />)} />
            <Route path="/drivers" element={gate('operations', <Drivers />)} />
            <Route path="/identity-verifications" element={gate('operations', <IdentityVerifications />)} />
            <Route path="/customers" element={gate('operations', <Customers />)} />
            <Route path="/fleet-applications" element={gate('operations', <FleetApplications />, true)} />
            <Route path="/fleets" element={gate('operations', <FleetManagement />)} />
            <Route path="/vehicles" element={gate('operations', <Vehicles />)} />
            <Route path="/documents" element={gate('operations', <Documents />)} />
            <Route path="/finance" element={gate('finance', <Finance />)} />
            <Route path="/payments" element={gate('finance', <PaymentsPayouts />)} />
            <Route path="/pricing" element={gate('system', <Settings />)} />
            <Route path="/communications" element={gate('communications', <Communications />)} />
            <Route path="/actions" element={gate('operations', <ActionCenter />)} />
            <Route path="/integrations" element={gate('system', <SystemIntegrations />)} />
            <Route path="/admins" element={gate('system', <AdminRoles />, true)} />
            <Route path="/support" element={gate('support', <Support />)} />
            <Route path="/audit" element={gate('system', <Audit />)} />
            <Route path="/settings" element={gate('system', <Settings />)} />
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
