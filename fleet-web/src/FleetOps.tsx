import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  apiError,
  FleetDocumentsResponse,
  FleetLiveDriver,
  FleetOverview,
  FleetSelfieVerification,
  FleetVehicle,
} from './api';

const fmtMoney = (v: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(v) || 0))} kr`;
const fmtTime = (v?: string | null) => v ? new Date(v).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const fmtDateTime = (v?: string | null) => v ? new Date(v).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const nameOf = (d: FleetLiveDriver) => d.name || 'Sjåfør';
const plateOf = (d: FleetLiveDriver) => (d.plate || 'Uten skilt').toUpperCase();
const carOf = (d: FleetLiveDriver) => d.car || 'KJAPP-kjøretøy';
const hasGps = (d: FleetLiveDriver) => Number.isFinite(Number(d.last_lat)) && Number.isFinite(Number(d.last_lng));

function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{right}</div>;
}
function ErrorBox({ message }: { message?: string }) { return message ? <div className="error-box">{message}</div> : null; }
function Loading() { return <div className="page-loading"><div className="spinner" /></div>; }
function Pill({ tone = 'muted', children }: { tone?: 'green'|'amber'|'red'|'muted'; children: React.ReactNode }) { return <span className={`ops-pill ${tone}`}>{children}</span>; }

function statusTone(status?: string): 'green'|'amber'|'red'|'muted' {
  if (['available', 'verified', 'approved'].includes(status || '')) return 'green';
  if (['to_pickup', 'at_pickup', 'on_trip', 'pending', 'gps_stale', 'submitted'].includes(status || '')) return 'amber';
  if (['rejected', 'missing'].includes(status || '')) return 'red';
  return 'muted';
}
function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    available: 'Ledig',
    to_pickup: 'På vei til kunde',
    at_pickup: 'Ved hentested',
    on_trip: 'På tur',
    gps_stale: 'GPS utløpt',
    offline: 'Offline',
    pending: 'Venter på kontroll',
    verified: 'Godkjent',
    rejected: 'Avvist',
    missing: 'Mangler',
    submitted: 'Innsendt',
    approved: 'Godkjent',
  };
  return labels[status || ''] || status || 'Ukjent';
}

function usePolling<T>(load: () => Promise<T>, intervalMs = 8000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date>();
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const next = await load();
        if (active) { setData(next); setError(''); setUpdatedAt(new Date()); }
      } catch (e) {
        if (active) setError(apiError(e));
      }
    };
    run();
    const timer = window.setInterval(run, intervalMs);
    return () => { active = false; window.clearInterval(timer); };
  }, [intervalMs]);
  return { data, error, updatedAt };
}

function bounds(drivers: FleetLiveDriver[]) {
  const pts = drivers.filter(hasGps).map((d) => ({ lat: Number(d.last_lat), lng: Number(d.last_lng) }));
  if (!pts.length) return { minLat: 59.86, maxLat: 59.98, minLng: 10.62, maxLng: 10.86 };
  const minLat = Math.min(...pts.map((p) => p.lat)); const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng)); const maxLng = Math.max(...pts.map((p) => p.lng));
  const padLat = Math.max(0.015, (maxLat - minLat) * .25);
  const padLng = Math.max(0.025, (maxLng - minLng) * .25);
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

function LiveMap({ drivers, onSelect, selectedId }: { drivers: FleetLiveDriver[]; onSelect: (d: FleetLiveDriver) => void; selectedId?: string }) {
  const b = bounds(drivers);
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${b.minLng}%2C${b.minLat}%2C${b.maxLng}%2C${b.maxLat}&layer=mapnik`;
  const pos = (d: FleetLiveDriver) => {
    const lat = Number(d.last_lat); const lng = Number(d.last_lng);
    const x = b.maxLng === b.minLng ? 50 : ((lng - b.minLng) / (b.maxLng - b.minLng)) * 100;
    const y = b.maxLat === b.minLat ? 50 : 100 - ((lat - b.minLat) / (b.maxLat - b.minLat)) * 100;
    return { left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(4, Math.min(96, y))}%` };
  };
  const visible = drivers.filter(hasGps);
  return <div className="ops-map-card">
    <iframe title="KJAPP live flåtekart" src={mapUrl} loading="lazy" />
    <div className="ops-map-overlay" />
    {visible.map((d) => <button key={d.id} className={`ops-car-marker ${d.operational_status || 'offline'} ${selectedId === d.id ? 'selected' : ''}`} style={pos(d)} onClick={() => onSelect(d)} title={`${nameOf(d)} · ${plateOf(d)}`}>●</button>)}
    {!visible.length ? <div className="ops-map-empty">Ingen biler har posisjon akkurat nå</div> : null}
  </div>;
}

export function FleetLiveOpsPage() {
  const live = usePolling(() => api.live());
  const overview = usePolling(() => api.overview());
  const drivers = live.data?.drivers || [];
  const [selectedId, setSelectedId] = useState<string>();
  const selected = drivers.find((d) => d.id === selectedId);
  const counts = useMemo(() => ({
    online: drivers.filter((d) => d.operational_status !== 'offline').length,
    available: drivers.filter((d) => d.operational_status === 'available').length,
    trips: drivers.filter((d) => ['to_pickup','at_pickup','on_trip'].includes(d.operational_status || '')).length,
    stale: drivers.filter((d) => d.operational_status === 'gps_stale').length,
  }), [drivers]);
  if (!live.data && !live.error) return <Loading />;
  return <div className="page-content ops-page">
    <PageHead title="Live drift" sub="Ekte fleet-scopet GPS- og driftsstatus fra KJAPP-backenden" right={<div className="ops-refresh">Oppdateres hvert 8. sekund<br/><strong>{live.updatedAt ? fmtTime(live.updatedAt.toISOString()) : '—'}</strong></div>} />
    <div className="ops-kpis">
      <div><span>Pålogget</span><strong>{counts.online}</strong></div>
      <div><span>Ledige</span><strong>{counts.available}</strong></div>
      <div><span>Aktive turer</span><strong>{counts.trips}</strong></div>
      <div><span>GPS utløpt</span><strong>{counts.stale}</strong></div>
    </div>
    <div className="ops-live-layout">
      <LiveMap drivers={drivers} onSelect={(d) => setSelectedId(d.id)} selectedId={selectedId} />
      <aside className="ops-side-panel">
        {selected ? <>
          <div className="eyebrow green">VALGT BIL</div>
          <h2>{carOf(selected)}</h2><p className="ops-plate">{plateOf(selected)}</p>
          <Pill tone={statusTone(selected.operational_status)}>{statusLabel(selected.operational_status)}</Pill>
          <div className="ops-facts">
            <span>Sjåfør</span><strong>{nameOf(selected)}</strong>
            <span>Sist GPS</span><strong>{fmtTime(selected.last_location_at)}</strong>
            <span>Dagens turer</span><strong>{selected.today_trips || 0}</strong>
            <span>Dagens omsetning</span><strong>{fmtMoney(selected.today_income || 0)}</strong>
            <span>Selfie ID</span><strong>{statusLabel(selected.selfie_verification_status)}</strong>
            {selected.active_trip ? <><span>Aktiv tur</span><strong>{selected.active_trip.trip_id || 'Pågående'}</strong></> : null}
          </div>
        </> : <><div className="eyebrow">LIVE FLÅTE</div><h2>Klikk på en bil</h2><p className="muted">Velg en markør for sjåfør, bil, GPS, turstatus og dagens omsetning.</p></>}
      </aside>
    </div>
    <div className="ops-list-card">
      <div className="ops-list-head"><strong>Alle biler</strong><span>{drivers.length} registrert · {overview.data?.today?.trips ?? 0} turer i dag</span></div>
      {drivers.map((d) => <button key={d.id} className="ops-row-button" onClick={() => setSelectedId(d.id)}>
        <span><i className={`status-dot ${d.online ? 'on' : ''}`} />{nameOf(d)}</span>
        <span>{carOf(d)} · {plateOf(d)}</span>
        <span>{statusLabel(d.operational_status)}</span>
        <b>{fmtMoney(d.today_income || 0)}</b>
      </button>)}
    </div>
    <ErrorBox message={live.error || overview.error} />
  </div>;
}

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.vehicles().then((r) => setVehicles(r.vehicles || [])).catch((e) => setError(apiError(e))); }, []);
  if (!vehicles && !error) return <Loading />;
  return <div className="page-content ops-page">
    <PageHead title="Biler" sub="Kjøretøyoversikt fra sjåfør- og flåtetilknytning i backend" />
    <div className="ops-table-card"><div className="ops-table vehicle">
      <div className="ops-tr ops-th"><span>Bil</span><span>Skilt</span><span>Sjåfør(er)</span><span>Status</span><span>Sist GPS</span><span>Godkjenning</span></div>
      {(vehicles || []).map((v) => <div className="ops-tr" key={v.id}>
        <span>{v.car || 'KJAPP-kjøretøy'}</span>
        <span className="mono">{v.plate || '—'}</span>
        <span>{v.drivers.map((d) => d.name || 'Sjåfør').join(', ') || '—'}</span>
        <span><Pill tone={v.online ? 'green' : 'muted'}>{v.online ? 'Online' : 'Offline'}</Pill></span>
        <span>{fmtDateTime(v.last_location_at)}</span>
        <span><Pill tone={v.approved ? 'green' : 'amber'}>{v.approved ? 'Godkjent' : 'Krever kontroll'}</Pill></span>
      </div>)}
    </div></div>
    <ErrorBox message={error} />
  </div>;
}

const DOC_LABELS: Record<string, string> = {
  firmaattest: 'Firmaattest',
  loyvebevis: 'Løyvebevis',
  vognkort: 'Vognkort',
  forsikring: 'Forsikring',
  bank: 'Bankkonto/utbetaling',
};

export function FleetDocumentsPage() {
  const [data, setData] = useState<FleetDocumentsResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.fleetDocuments().then(setData).catch((e) => setError(apiError(e))); }, []);
  if (!data && !error) return <Loading />;
  return <div className="page-content ops-page">
    <PageHead title="Dokumenter" sub="Fleet- og sjåførdokumentasjon, alltid scopet til innlogget løyvehaver" right={<Pill tone={statusTone(data?.fleet_application_status)}>{statusLabel(data?.fleet_application_status)}</Pill>} />
    <div className="ops-doc-grid">
      {(data?.fleet_documents || []).map((d) => <div className="ops-doc-card" key={d.type}>
        <span>{DOC_LABELS[d.type] || d.type}</span>
        <strong>{d.filename || 'Registrert'}</strong>
        <Pill tone={statusTone(d.status)}>{statusLabel(d.status)}</Pill>
      </div>)}
      {!data?.fleet_documents?.length ? <div className="ops-doc-card"><span>Flåtedokumenter</span><strong>Ingen dokumentmetadata funnet</strong><Pill tone="amber">Kontroller søknaden</Pill></div> : null}
    </div>
    <div className="ops-table-card"><div className="ops-list-head"><strong>Sjåførdokumenter</strong><span>{data?.drivers.length || 0} sjåfører</span></div><div className="ops-table docs">
      <div className="ops-tr ops-th"><span>Sjåfør</span><span>Førerkort</span><span>Kjøreseddel</span><span>Profilbilde</span><span>Selfie ID</span></div>
      {(data?.drivers || []).map((d) => <div className="ops-tr" key={d.driver_id}>
        <span>{d.driver_name || 'Sjåfør'}</span>
        {['drivers_license','taxi_license','profile_photo'].map((key) => <span key={key}><Pill tone={d.documents[key]?.present ? 'green' : 'red'}>{d.documents[key]?.present ? 'Mottatt' : 'Mangler'}</Pill></span>)}
        <span><Pill tone={statusTone(d.selfie_verification_status)}>{statusLabel(d.selfie_verification_status)}</Pill></span>
      </div>)}
    </div></div>
    <ErrorBox message={error} />
  </div>;
}

export function DriverVerificationPage() {
  const [rows, setRows] = useState<FleetSelfieVerification[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.selfieVerifications().then((r) => setRows(r.verifications || [])).catch((e) => setError(apiError(e))); }, []);
  if (!rows && !error) return <Loading />;
  const verified = (rows || []).filter((r) => r.status === 'verified').length;
  const pending = (rows || []).filter((r) => r.status === 'pending').length;
  return <div className="page-content ops-page">
    <PageHead title="Selfie ID Verification" sub="Fleet-eier ser status; identitetsbildet er begrenset til sjåfør og KJAPP review" right={<div className="ops-refresh"><strong>{verified} godkjent</strong><br/>{pending} venter</div>} />
    <div className="ops-verification-note"><strong>Sikker beta-flyt:</strong> Selfie-ID lagres separat fra vanlige sjåførdokumenter. Fleet ser status, mens KJAPP Admin utfører manuell kontroll. Automatisk biometrisk ansiktsmatch er ikke aktivert i denne fasen.</div>
    <div className="ops-table-card"><div className="ops-table verify">
      <div className="ops-tr ops-th"><span>Sjåfør</span><span>Konto</span><span>Innsendt</span><span>Kontrollert</span><span>Status</span></div>
      {(rows || []).map((r) => <div className="ops-tr" key={r.driver_id}>
        <span>{r.driver_name || 'Sjåfør'}</span>
        <span><Pill tone={r.approved ? 'green' : 'amber'}>{r.approved ? 'Aktiv' : 'Venter godkjenning'}</Pill></span>
        <span>{fmtDateTime(r.submitted_at)}</span>
        <span>{fmtDateTime(r.verified_at)}</span>
        <span><Pill tone={statusTone(r.status)}>{statusLabel(r.status)}</Pill></span>
      </div>)}
    </div></div>
    <ErrorBox message={error} />
  </div>;
}

export function FleetLiveTripsPage() {
  const live = usePolling(() => api.liveTrips());
  const trips = live.data?.trips || [];
  if (!live.data && !live.error) return <Loading />;
  return <div className="page-content ops-page">
    <PageHead title="Live turer" sub="Pågående turer utført av sjåfører i din egen flåte" right={<div className="ops-refresh">Oppdateres hvert 8. sekund<br/><strong>{live.updatedAt ? fmtTime(live.updatedAt.toISOString()) : '—'}</strong></div>} />
    <div className="ops-kpis"><div><span>Pågående</span><strong>{trips.length}</strong></div><div><span>På vei til kunde</span><strong>{trips.filter((t:any) => ['accepted','driver_on_way'].includes(t.status)).length}</strong></div><div><span>Ved hentested</span><strong>{trips.filter((t:any) => t.status === 'at_pickup').length}</strong></div><div><span>På tur</span><strong>{trips.filter((t:any) => ['in_trip','arrived'].includes(t.status)).length}</strong></div></div>
    <div className="ops-table-card"><div className="ops-table live-trips">
      <div className="ops-tr ops-th"><span>Tur</span><span>Sjåfør</span><span>Fra → til</span><span>Status</span><span>Pris</span></div>
      {trips.map((t:any) => <div className="ops-tr" key={t.trip_id}>
        <span className="mono">{t.trip_id || '—'}</span>
        <span>{t.driver?.name || 'Sjåfør'}{t.driver?.plate ? ` · ${t.driver.plate}` : ''}</span>
        <span>{t.pickup_address || '—'} → {t.dropoff_address || '—'}</span>
        <span><Pill tone="amber">{statusLabel(t.status === 'driver_on_way' || t.status === 'accepted' ? 'to_pickup' : t.status === 'at_pickup' ? 'at_pickup' : 'on_trip')}</Pill></span>
        <span>{fmtMoney(t.price || 0)}</span>
      </div>)}
      {!trips.length ? <div className="empty-state padded">Ingen aktive turer akkurat nå.</div> : null}
    </div></div>
    <ErrorBox message={live.error} />
  </div>;
}
