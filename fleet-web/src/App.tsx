import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, FleetMe } from './api';
import { useAuth } from './auth';
import DriverSignup from './DriverSignup';
import { DriversV2Page } from './FleetV2DriversPage';
import { Driver360Page, InvitationsPage, OperationsDashboardPage } from './FleetV2Pages';
import FigmaDocumentsPage from './FigmaDocumentsPage';
import FigmaSettingsPage from './FigmaSettingsPage';
import { FigmaFinancePage, FigmaLiveOpsPage, FigmaTripsPage, FigmaVehiclesPage } from './FigmaOperationsPages';
import { SnarForcePasswordChangePage, SnarForgotPasswordPage, SnarLoginPage, SnarResetPasswordPage } from './SnarAuthPages';
import SupportAiPage from './SupportAiPage';
import FleetHubOverview from './FleetHubOverview';

const NAV = [
  { to: '/', label: 'Oversikt', end: true, icon: '⌂' },
  { to: '/live', label: 'Live kart', icon: '●' },
  { to: '/sjaforer', label: 'Sjåfører', icon: '◎' },
  { to: '/kjoretoy', label: 'Kjøretøy', icon: '◇' },
  { to: '/invitasjoner', label: 'Invitasjoner', icon: '＋' },
  { to: '/turer', label: 'Turer', icon: '↗' },
  { to: '/okonomi', label: 'Økonomi', icon: '○' },
  { to: '/dokumenter', label: 'Dokumenter', icon: '▤' },
  { to: '/meldinger', label: 'Meldinger / SNAR AI', icon: '✦' },
  { to: '/bedrift', label: 'Innstillinger', icon: '□' },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand snar-brand ${compact ? 'compact' : ''}`} aria-label="SNAR Fleet">
      <span className="snar-brand-mark" aria-hidden="true"><i /><i /></span>
      <span className="snar-brand-type">
        <span className="brand-word">SNAR</span>
        <span className="brand-sub">FLEET</span>
      </span>
    </div>
  );
}

function PortalShell() {
  const { logout } = useAuth();
  const [fleet, setFleet] = useState<FleetMe | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.fleetMe().then(setFleet).catch(() => setFleet(null));
  }, []);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const nav = (
    <nav className="portal-nav" aria-label="Fleetportal">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}
          className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}>
          <span className="portal-nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <Brand />
        <div className="sidebar-badge"><span /> OSLO BETA</div>
        <div className="sidebar-rule" />
        {nav}
        <div className="sidebar-account">
          <div className="sidebar-account-kicker">INNLOGGET FLÅTE</div>
          <div className="sidebar-company">{fleet?.name || 'SNAR Fleet'}</div>
          {fleet?.org_number ? <div className="sidebar-org">Org.nr {fleet.org_number}</div> : null}
          <button className="sidebar-logout" onClick={logout}>Logg ut</button>
        </div>
      </aside>

      <div className="mobile-top">
        <Brand compact />
        <button className="mobile-menu-button" onClick={() => setMenuOpen((v) => !v)} aria-label="Åpne meny">•••</button>
      </div>
      {menuOpen ? (
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            {nav}
            <div className="mobile-menu-company">
              <strong>{fleet?.name || 'SNAR Fleet'}</strong>
              {fleet?.org_number ? <span>Org.nr {fleet.org_number}</span> : null}
            </div>
            <button className="mobile-logout" onClick={logout}>Logg ut</button>
          </div>
        </div>
      ) : null}

      <main className="portal-main">
        <div className="portal-topbar" aria-hidden="true">
          <span>{fleet?.name || 'SNAR Fleet'}</span>
          <span className="portal-topbar-status"><i /> System online</span>
        </div>
        <Routes>
          <Route path="/" element={<OperationsDashboardPage />} />
          <Route path="/live" element={<FigmaLiveOpsPage />} />
          <Route path="/sjaforer" element={<DriversV2Page />} />
          <Route path="/sjaforer/:driverId" element={<Driver360Page />} />
          <Route path="/kjoretoy" element={<FigmaVehiclesPage />} />
          <Route path="/invitasjoner" element={<InvitationsPage />} />
          <Route path="/turer" element={<FigmaTripsPage />} />
          <Route path="/dokumenter" element={<FigmaDocumentsPage />} />
          <Route path="/okonomi" element={<FigmaFinancePage />} />
          <Route path="/meldinger" element={<SupportAiPage />} />
          <Route path="/bedrift" element={<FigmaSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();

  if (location.pathname.startsWith('/driver-signup/')) {
    return <Routes><Route path="/driver-signup/:token" element={<DriverSignup />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  }

  if (user === undefined) return <div className="full-loader"><div className="spinner" /></div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<SnarLoginPage />} />
        <Route path="/glemt-passord" element={<SnarForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<SnarResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  if (user.must_reset_password) return <SnarForcePasswordChangePage />;
  return <PortalShell />;
}
