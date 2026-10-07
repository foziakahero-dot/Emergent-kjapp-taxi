import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { Loader } from './ui';
import Login from './Login';
import { Icon, SnarMark } from './snar-ui';
import FleetApplications from './FleetApplications';
import {
  Dashboard, Live, Trips, Drivers, Customers, Vehicles, Documents, Finance, Support, Audit, Settings,
} from './pages';
import {
  FleetManagement, PaymentsPayouts, Communications, ActionCenter, SystemIntegrations, AdminRoles,
} from './controlCenter';

const NAV = [
  { group: 'Oversikt', items: [
    { to: '/', label: 'Dashbord', ic: 'grid', end: true, perm: 'operations' },
    { to: '/live', label: 'Live drift', ic: 'map', perm: 'operations' },
    { to: '/actions', label: 'Krever handling', ic: 'alert', perm: 'operations' },
  ]},
  { group: 'Drift', items: [
    { to: '/trips', label: 'Turer', ic: 'route', perm: 'operations' },
    { to: '/drivers', label: 'Sjåfører', ic: 'users', perm: 'operations' },
    { to: '/customers', label: 'Kunder', ic: 'user', perm: 'operations' },
    { to: '/fleet-applications', label: 'Løyvesøknader', ic: 'file', superadminOnly: true },
    { to: '/fleets', label: 'Løyvehavere', ic: 'building', perm: 'operations' },
    { to: '/vehicles', label: 'Kjøretøy', ic: 'car', perm: 'operations' },
  ]},
  { group: 'Økonomi', items: [
    { to: '/finance', label: 'Økonomi', ic: 'wallet', perm: 'finance' },
    { to: '/payments', label: 'Betaling & oppgjør', ic: 'creditcard', perm: 'finance' },
    { to: '/pricing', label: 'Prissetting', ic: 'tag', perm: 'system' },
  ]},
  { group: 'Kommunikasjon & support', items: [
    { to: '/communications', label: 'Kommunikasjon', ic: 'send', perm: 'communications' },
    { to: '/support', label: 'Support', ic: 'chat', perm: 'support' },
    { to: '/documents', label: 'Dokumenter', ic: 'file', perm: 'operations' },
  ]},
  { group: 'System', items: [
    { to: '/integrations', label: 'Integrasjoner', ic: 'plug', perm: 'system' },
    { to: '/admins', label: 'Administratorer', ic: 'shield', superadminOnly: true },
    { to: '/audit', label: 'Audit-logg', ic: 'log', perm: 'system' },
    { to: '/settings', label: 'Innstillinger', ic: 'settings', perm: 'system' },
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
    <div className="search global-search" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <Icon name="search" size={16}/><input aria-label="Globalt søk" placeholder="Søk turer, sjåfører, kunder, løyvehavere…" value={q}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<any>({});
  useEffect(() => { api.overview().then(setCounts).catch(() => {}); }, []);
  const initials = (user?.fullName || user?.email || 'A').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Lukk meny" onClick={() => setMobileOpen(false)}/>}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row"><div className="brand-lockup"><SnarMark/><div className="brand-text"><strong>SNAR</strong><span>CONTROL CENTER</span></div></div><button className="icon-btn sidebar-close" aria-label="Lukk meny" onClick={() => setMobileOpen(false)}><Icon name="close"/></button></div>
        <nav className="sidebar-nav" aria-label="Hovedmeny">
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items
              .filter((it: any) => {
                if (it.superadminOnly && user?.role !== 'superadmin') return false;
                if (!it.perm || user?.role === 'superadmin') return true;
                if (user?.permissions == null) return true; // legacy admin keeps existing access
                return user.permissions.includes(it.perm);
              })
              .map((it: any) => (
              <NavLink onClick={() => setMobileOpen(false)} key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}>
                <Icon name={it.ic}/>{it.label}
                {it.to === '/drivers' && counts?.drivers?.pending ? <span className="nav-badge">{counts.drivers.pending}</span> : null}
                {it.to === '/fleet-applications' && counts?.fleets?.pending_applications ? <span className="nav-badge">{counts.fleets.pending_applications}</span> : null}
                {it.to === '/support' && counts?.support?.open ? <span className="nav-badge">{counts.support.open}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
        </nav><div className="sidebar-foot"><div className="admin-profile"><div className="avatar av-sm">{initials}</div><div className="admin-profile-info"><strong>{user?.fullName || user?.email}</strong><span>{user?.role === "superadmin" ? "Superadministrator" : "Administrator"}</span></div><button className="icon-btn" aria-label="Logg ut" onClick={logout}><Icon name="logout" size={16}/></button></div></div>
      </aside>

      <div className="app-main">
        <div className="topbar">
          <div className="topbar-left"><button className="icon-btn mobile-menu" aria-label="Åpne meny" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Icon name="menu"/></button>{can('operations') ? <GlobalSearch /> : <span>SNAR Control Center</span>}</div>
          <div className="topbar-right">
            <span className="who-email">{user?.email}</span>
            <div className="avatar av-sm">{initials}</div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logg ut</button>
          </div>
        </div>
        <main className="main-content">
          <Routes>
            <Route path="/" element={gate('operations', <Dashboard />)} />
            <Route path="/live" element={gate('operations', <Live />)} />
            <Route path="/trips" element={gate('operations', <Trips />)} />
            <Route path="/drivers" element={gate('operations', <Drivers />)} />
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
            <Route path="*" element={gate('operations', <Dashboard />)} />
          </Routes>
        </main><footer className="app-footer"><span>SNAR Control Center v2.0</span><span>{user?.role}</span></footer>
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

