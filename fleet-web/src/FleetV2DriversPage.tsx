import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiError, FleetDriver, FleetVehicle } from './api';

const money = (value: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(value) || 0))} kr`;
const nameOf = (driver: FleetDriver) => driver.fullName || driver.full_name || driver.email || 'Sjåfør';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SN';

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return <span className="v2-avatar">{initials(name)}{online ? <i className="v2-presence" /> : null}</span>;
}

function Pill({ tone, children }: { tone: 'green'|'red'|'amber'|'blue'|'neutral'; children: React.ReactNode }) {
  return <span className={`v2-status ${tone}`}>{children}</span>;
}

export function DriversV2Page() {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all'|'online'|'offline'|'pending'>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([api.drivers(), api.vehicles()])
      .then(([driverData, vehicleData]) => {
        if (!alive) return;
        setDrivers(driverData.drivers || []);
        setVehicles(vehicleData.vehicles || []);
        setError('');
      })
      .catch((e) => alive && setError(apiError(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => drivers.filter((driver) => {
    const haystack = `${nameOf(driver)} ${driver.email || ''} ${driver.phone || ''} ${driver.car || ''} ${driver.plate || ''}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesFilter = filter === 'all'
      || (filter === 'online' && driver.online)
      || (filter === 'offline' && !driver.online)
      || (filter === 'pending' && (!driver.approved || driver.fleet_active === false));
    return matchesQuery && matchesFilter;
  }), [drivers, query, filter]);

  const online = drivers.filter((driver) => driver.online).length;
  const pending = drivers.filter((driver) => !driver.approved || driver.fleet_active === false).length;

  if (loading) return <div className="v2-loading"><span /></div>;

  return <div className="v2-page">
    <div className="v2-page-head">
      <div><h1>Sjåfører</h1><p>Administrer sjåfører, status og tilknyttede kjøretøy.</p></div>
      <div className="v2-page-actions"><Link className="v2-primary" to="/invitasjoner">+ Inviter sjåfør</Link></div>
    </div>

    <div className="v2-card v2-driver-directory">
      <div className="v2-driver-toolbar">
        <div className="v2-search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk på navn, telefon, e-post eller bil…" /></div>
        <div className="v2-filter-tabs">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle ({drivers.length})</button>
          <button type="button" className={filter === 'online' ? 'active' : ''} onClick={() => setFilter('online')}>Online ({online})</button>
          <button type="button" className={filter === 'offline' ? 'active' : ''} onClick={() => setFilter('offline')}>Offline ({Math.max(0, drivers.length - online)})</button>
          <button type="button" className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Venter godkjenning ({pending})</button>
        </div>
      </div>

      <div className="v2-driver-table">
        <div className="head"><span>Sjåfør</span><span>Status</span><span>Bil</span><span>Dokumenter</span><span>Turer i dag</span><span>Inntekt i dag</span><span /></div>
        {rows.map((driver) => {
          const vehicle = vehicles.find((item) => item.driver_id === driver.id);
          const approved = driver.approved && driver.fleet_active !== false;
          return <Link to={`/sjaforer/${driver.id}`} className="row" key={driver.id}>
            <span className="person"><Avatar name={nameOf(driver)} online={driver.online} /><span><strong>{nameOf(driver)}</strong><small>{driver.email || driver.phone || 'Kontaktinfo mangler'}</small></span></span>
            <span><Pill tone={driver.online ? 'green' : 'neutral'}>{driver.online ? 'Online' : 'Offline'}</Pill></span>
            <span><strong>{vehicle?.car || driver.car || 'Ikke tildelt'}</strong><small>{vehicle?.plate || driver.plate || '—'}</small></span>
            <span><Pill tone={approved ? 'green' : 'amber'}>{approved ? 'Gyldig' : 'Til kontroll'}</Pill></span>
            <span className="mono">{driver.today_trips || 0}</span>
            <span className="mono">{money(driver.today_income || 0)}</span>
            <span className="arrow">›</span>
          </Link>;
        })}
        {!rows.length ? <div className="v2-empty-row">Ingen sjåfører matcher søket eller filteret.</div> : null}
      </div>
    </div>
    {error ? <div className="v2-inline-error">{error}</div> : null}
  </div>;
}
