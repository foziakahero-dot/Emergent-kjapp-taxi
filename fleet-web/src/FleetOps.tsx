import React, { useEffect, useMemo, useState } from 'react';
import { api, apiError, FleetDriver, FleetMe, FleetOverview } from './api';

const fmtMoney = (v: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(v) || 0))} kr`;
const fmtTime = (v?: string) => v ? new Date(v).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const nameOf = (d: FleetDriver) => d.fullName || d.full_name || d.email || 'Sjåfør';
const plateOf = (d: FleetDriver) => (d.plate || 'Uten skilt').toUpperCase();
const carOf = (d: FleetDriver) => d.car || 'KJAPP-kjøretøy';
const hasGps = (d: FleetDriver) => Number.isFinite(Number(d.last_lat)) && Number.isFinite(Number(d.last_lng));
const isFresh = (d: FleetDriver, maxSeconds = 120) => {
  if (!d.last_location_at) return false;
  return Date.now() - new Date(d.last_location_at).getTime() <= maxSeconds * 1000;
};
const liveState = (d: FleetDriver) => !d.online ? 'offline' : hasGps(d) && isFresh(d) ? 'online' : 'stale';
const statusLabel = (d: FleetDriver) => liveState(d) === 'online' ? 'Online · GPS fersk' : liveState(d) === 'stale' ? 'Online · GPS utløpt' : 'Offline';

type LoadState = { me: FleetMe | null; overview: FleetOverview | null; drivers: FleetDriver[]; error: string; loading: boolean; updatedAt?: Date };

function useFleetOps(poll = false) {
  const [state, setState] = useState<LoadState>({ me: null, overview: null, drivers: [], error: '', loading: true });
  const load = async () => {
    try {
      const [me, overview, drivers] = await Promise.all([api.fleetMe(), api.overview(), api.drivers()]);
      setState({ me, overview, drivers: drivers.drivers || [], error: '', loading: false, updatedAt: new Date() });
    } catch (e) {
      setState((s) => ({ ...s, error: apiError(e), loading: false }));
    }
  };
  useEffect(() => {
    let active = true;
    const run = async () => { if (active) await load(); };
    run();
    if (!poll) return () => { active = false; };
    const timer = window.setInterval(run, 8000);
    return () => { active = false; window.clearInterval(timer); };
  }, [poll]);
  return { ...state, reload: load };
}

function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{right}</div>;
}
function ErrorBox({ message }: { message?: string }) { return message ? <div className="error-box">{message}</div> : null; }
function Loading() { return <div className="page-loading"><div className="spinner" /></div>; }
function Pill({ tone = 'muted', children }: { tone?: 'green'|'amber'|'red'|'muted'; children: React.ReactNode }) { return <span className={`ops-pill ${tone}`}>{children}</span>; }

function bounds(drivers: FleetDriver[]) {
  const pts = drivers.filter(hasGps).map((d) => ({ lat: Number(d.last_lat), lng: Number(d.last_lng) }));
  if (!pts.length) return { minLat: 59.86, maxLat: 59.98, minLng: 10.62, maxLng: 10.86 };
  const minLat = Math.min(...pts.map((p) => p.lat)); const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng)); const maxLng = Math.max(...pts.map((p) => p.lng));
  const padLat = Math.max(0.015, (maxLat - minLat) * .25);
  const padLng = Math.max(0.025, (maxLng - minLng) * .25);
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

function LiveMap({ drivers, onSelect, selectedId }: { drivers: FleetDriver[]; onSelect: (d: FleetDriver) => void; selectedId?: string }) {
  const b = bounds(drivers);
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${b.minLng}%2C${b.minLat}%2C${b.maxLng}%2C${b.maxLat}&layer=mapnik`;
  const pos = (d: FleetDriver) => {
    const lat = Number(d.last_lat); const lng = Number(d.last_lng);
    const x = b.maxLng === b.minLng ? 50 : ((lng - b.minLng) / (b.maxLng - b.minLng)) * 100;
    const y = b.maxLat === b.minLat ? 50 : 100 - ((lat - b.minLat) / (b.maxLat - b.minLat)) * 100;
    return { left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(4, Math.min(96, y))}%` };
  };
  const visible = drivers.filter(hasGps);
  return <div className="ops-map-card">
    <iframe title="KJAPP live flåtekart" src={mapUrl} loading="lazy" />
    <div className="ops-map-overlay" />
    {visible.map((d) => <button key={d.id} className={`ops-car-marker ${liveState(d)} ${selectedId === d.id ? 'selected' : ''}`} style={pos(d)} onClick={() => onSelect(d)} title={`${nameOf(d)} · ${plateOf(d)}`}>●</button>)}
    {!visible.length ? <div className="ops-map-empty">Ingen biler har posisjon akkurat nå</div> : null}
  </div>;
}

export function FleetLiveOpsPage() {
  const { drivers, overview, error, loading, updatedAt } = useFleetOps(true);
  const [selected, setSelected] = useState<FleetDriver | null>(null);
  const active = drivers.filter((d) => d.online);
  const fresh = drivers.filter((d) => d.online && hasGps(d) && isFresh(d));
  const stale = drivers.filter((d) => d.online && (!hasGps(d) || !isFresh(d)));
  const selectedDriver = selected && drivers.find((d) => d.id === selected.id) || selected;
  if (loading) return <Loading />;
  return <div className="page-content ops-page">
    <PageHead title="Live drift" sub="Sanntidsoversikt over egne biler, sjåfører og GPS-status" right={<div className="ops-refresh">Oppdateres hvert 8. sekund<br/><strong>{updatedAt ? fmtTime(updatedAt.toISOString()) : '—'}</strong></div>} />
    <div className="ops-kpis"><div><span>Pålogget</span><strong>{active.length}</strong></div><div><span>GPS fersk</span><strong>{fresh.length}</strong></div><div><span>GPS utløpt</span><strong>{stale.length}</strong></div><div><span>Turer i dag</span><strong>{overview?.today?.trips ?? 0}</strong></div></div>
    <div className="ops-live-layout"><LiveMap drivers={drivers} onSelect={setSelected} selectedId={selectedDriver?.id} />
      <aside className="ops-side-panel">
        {selectedDriver ? <><div className="eyebrow green">VALGT BIL</div><h2>{carOf(selectedDriver)}</h2><p className="ops-plate">{plateOf(selectedDriver)}</p><Pill tone={liveState(selectedDriver) === 'online' ? 'green' : liveState(selectedDriver) === 'stale' ? 'amber' : 'muted'}>{statusLabel(selectedDriver)}</Pill><div className="ops-facts"><span>Sjåfør</span><strong>{nameOf(selectedDriver)}</strong><span>Sist GPS</span><strong>{fmtTime(selectedDriver.last_location_at)}</strong><span>Dagens turer</span><strong>{selectedDriver.today_trips || 0}</strong><span>Dagens omsetning</span><strong>{fmtMoney(selectedDriver.today_income || 0)}</strong></div></> : <><div className="eyebrow">LIVE FLÅTE</div><h2>Klikk på en bil</h2><p className="muted">Velg en markør på kartet for å se sjåfør, skilt, status, GPS og dagens omsetning.</p></>}
      </aside>
    </div>
    <div className="ops-list-card"><div className="ops-list-head"><strong>Alle biler</strong><span>{drivers.length} registrert</span></div>{drivers.map((d) => <button key={d.id} className="ops-row-button" onClick={() => setSelected(d)}><span><i className={`status-dot ${liveState(d) === 'online' ? 'on' : ''}`} />{nameOf(d)}</span><span>{carOf(d)} · {plateOf(d)}</span><span>{statusLabel(d)}</span><b>{fmtMoney(d.today_income || 0)}</b></button>)}</div>
    <ErrorBox message={error} />
  </div>;
}

export function VehiclesPage() {
  const { drivers, error, loading } = useFleetOps(false);
  if (loading) return <Loading />;
  return <div className="page-content ops-page"><PageHead title="Biler" sub="Kjøretøyoversikt for egen flåte" />
    <div className="ops-table-card"><div className="ops-table vehicle"><div className="ops-tr ops-th"><span>Bil</span><span>Skilt</span><span>Sjåfør</span><span>Live status</span><span>Dokumenter</span><span>I dag</span></div>{drivers.map((d) => { const docs = ['drivers_license_path','taxi_license_path','profile_photo_path'].filter((k) => Boolean((d as any)[k])).length; return <div className="ops-tr" key={d.id}><span>{carOf(d)}</span><span className="mono">{plateOf(d)}</span><span>{nameOf(d)}</span><span><Pill tone={liveState(d) === 'online' ? 'green' : liveState(d) === 'stale' ? 'amber' : 'muted'}>{statusLabel(d)}</Pill></span><span><Pill tone={docs >= 3 ? 'green' : 'amber'}>{docs}/3 sjåførdocs</Pill></span><span>{d.today_trips || 0} turer · {fmtMoney(d.today_income || 0)}</span></div>; })}</div></div><ErrorBox message={error} /></div>;
}

const FLEET_DOCS = [
  ['firmaattest', 'Firmaattest'], ['loyvebevis', 'Løyvebevis'], ['vognkort', 'Vognkort'], ['forsikring', 'Forsikring'], ['bank', 'Bankkonto/utbetaling'],
] as const;

export function FleetDocumentsPage() {
  const { me, drivers, error, loading } = useFleetOps(false);
  if (loading || !me) return <Loading />;
  const docs = ((me as any).documents || {}) as Record<string, any>;
  return <div className="page-content ops-page"><PageHead title="Dokumenter" sub="Fleet- og sjåførdokumentasjon med compliance-status" />
    <div className="ops-doc-grid">{FLEET_DOCS.map(([key, label]) => { const ok = Boolean(docs[key]?.path || docs[key]?.storage_path || (key === 'bank' && me.bank_account)); return <div className="ops-doc-card" key={key}><span>{label}</span><strong>{ok ? 'Registrert' : 'Mangler'}</strong><Pill tone={ok ? 'green' : 'red'}>{ok ? 'Godkjent/tilgjengelig' : 'Krever opplasting/review'}</Pill></div>; })}</div>
    <div className="ops-table-card"><div className="ops-list-head"><strong>Sjåførdokumenter</strong><span>{drivers.length} sjåfører</span></div><div className="ops-table docs"><div className="ops-tr ops-th"><span>Sjåfør</span><span>Førerkort</span><span>Kjøreseddel</span><span>Profilbilde</span><span>Selfie ID</span></div>{drivers.map((d) => <div className="ops-tr" key={d.id}><span>{nameOf(d)}</span>{['drivers_license_path','taxi_license_path','profile_photo_path','selfie_verification_path'].map((k) => <span key={k}><Pill tone={(d as any)[k] ? 'green' : 'amber'}>{(d as any)[k] ? 'Mottatt' : 'Mangler'}</Pill></span>)}</div>)}</div></div><ErrorBox message={error} /></div>;
}

export function DriverVerificationPage() {
  const { drivers, error, loading } = useFleetOps(false);
  if (loading) return <Loading />;
  const verified = drivers.filter((d) => (d as any).selfie_verification_path || (d as any).selfie_verified_at).length;
  return <div className="page-content ops-page"><PageHead title="Selfie ID Verification" sub="Kontroller at riktig person kjører på riktig sjåførkonto" right={<div className="ops-refresh"><strong>{verified}/{drivers.length}</strong><br/>selfie mottatt</div>} />
    <div className="ops-verification-note"><strong>Beta-flyt:</strong> Sjåfør laster opp selfie ved registrering. Fleet og Admin ser status. Neste steg etter beta er automatisk ansiktsmatch mot profilbilde/førerkort og daglig selfie før første tur.</div>
    <div className="ops-table-card"><div className="ops-table verify"><div className="ops-tr ops-th"><span>Sjåfør</span><span>Bil</span><span>Profilbilde</span><span>Selfie</span><span>Status</span></div>{drivers.map((d) => { const selfie = Boolean((d as any).selfie_verification_path || (d as any).selfie_verified_at); return <div className="ops-tr" key={d.id}><span>{nameOf(d)}</span><span>{carOf(d)} · {plateOf(d)}</span><span><Pill tone={(d as any).profile_photo_path ? 'green' : 'amber'}>{(d as any).profile_photo_path ? 'Mottatt' : 'Mangler'}</Pill></span><span><Pill tone={selfie ? 'green' : 'red'}>{selfie ? 'Mottatt' : 'Mangler'}</Pill></span><span><Pill tone={selfie ? 'green' : 'amber'}>{selfie ? 'Klar for review' : 'Må tas før godkjenning'}</Pill></span></div>; })}</div></div><ErrorBox message={error} /></div>;
}
