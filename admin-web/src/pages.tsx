import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from './api';
import { useAuth } from './auth';
import LiveMap from './LiveMap';
import {
  Bars, Btn, Card, Drawer, Empty, ErrorBanner, KV, Kpi, Loader, Modal, PageHead, Pagination,
  Pill, Route as RouteView, fmtDate, fmtDay, fmtMoney, useAsync, usePaged,
} from './ui';

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const PAGE = 25;

function hasFreshGps(driver: any) {
  const seen = Date.parse(driver.last_location_at || '');
  const age = Date.now() - seen;
  return Number.isFinite(seen) && age >= 0 && age <= 2 * 60_000 &&
    driver.lat != null && driver.lng != null &&
    Number.isFinite(Number(driver.lat)) && Math.abs(Number(driver.lat)) <= 90 &&
    Number.isFinite(Number(driver.lng)) && Math.abs(Number(driver.lng)) <= 180;
}

function hasRecentSignal(value: any) {
  const seen = Date.parse(value || '');
  const age = Date.now() - seen;
  return Number.isFinite(seen) && age >= 0 && age <= 2 * 60_000;
}

/* ----------------------------- Dashboard ----------------------------- */
export function Dashboard() {
  const ov = useAsync(() => api.overview(), []);
  const fin = useAsync(() => api.finance(30), []);
  const live = useAsync(() => api.live(), []);
  const twofa = useAsync(() => api.twofaStatus(), []);
  if (ov.loading) return <Loader />;
  if (ov.err) return <ErrorBanner msg={ov.err} />;
  const d = ov.data || {};
  const delta = (d.trips?.today ?? 0) - (d.trips?.yesterday ?? 0);
  const freshCount = (live.data?.drivers || []).filter(hasFreshGps).length;
  const staleOpen = live.data?.trips?.filter((t: any) => t.created_at && Date.now() - Date.parse(t.created_at) > 2 * 60 * 60_000).length ?? d.trips?.stale_active ?? 0;
  return (
    <>
      <PageHead title="Dashbord" sub={`Oppdatert ${fmtDate(d.as_of)}`} />
      {twofa.data?.required && !twofa.data?.enabled && <div className="error-banner" role="alert">
        Administratorkontoen mangler totrinnsbekreftelse. <a href="#/settings" style={{ textDecoration: 'underline' }}>Aktiver 2FA i Innstillinger.</a>
      </div>}
      <div className="grid cards">
        <Kpi label="Åpne turer" value={d.trips?.active ?? 0} accent
          foot={<span className="dim">{live.loading ? 'Kontrollerer GPS…' : live.err ? 'GPS-status utilgjengelig' : `${freshCount} sjåfører med fersk GPS`}{staleOpen ? ` · ${staleOpen} turer eldre enn 2t` : ''}</span>} />
        <Kpi label="Turer i dag" value={d.trips?.today ?? 0}
          foot={<span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs i går</span>} />
        <Kpi label="Brutto i dag (GMV)" value={fmtMoney(d.finance?.gmv_today)}
          foot={<span className="dim">{d.trips?.completed_today ?? 0} fullført</span>} />
        <Kpi label="KJAPP-inntekt i dag" value={fmtMoney(d.finance?.kjapp_revenue_today)} accent />
      </div>

      <div className="section-title">Siste 30 dager — brutto omsetning</div>
      <Card>
        {fin.loading ? <Loader /> : <Bars data={fin.data?.series || []} xkey="date" ykey="gmv" />}
      </Card>

      <div className="section-title">Krever oppmerksomhet</div>
      <div className="grid cards">
        <Shortcut ic="☗" n={d.drivers?.pending ?? 0} l="Sjåfører til godkjenning" c="amber" />
        <Shortcut ic="◉" n={d.trips?.active ?? 0} l="Åpne turer" c="blue" />
        <Shortcut ic="✆" n={d.support?.open ?? 0} l="Åpne supportsaker" c="red" />
        <Shortcut ic="≣" n={d.finance?.pending_payouts ?? 0} l="Utbetalinger i kø" c="gold" />
      </div>

      <div className="section-title">Flåte & kunder</div>
      <div className="grid cards">
        <Kpi label="Aktive løyvehavere" value={d.fleets?.active ?? 0} foot={<span className="dim">{d.fleets?.suspended ?? 0} suspendert</span>} />
        <Kpi label="Søknader (løyve)" value={d.fleets?.pending_applications ?? 0} />
        <Kpi label="Godkjente sjåfører" value={d.drivers?.approved ?? 0} />
        <Kpi label="Avbrutt i dag" value={d.trips?.cancelled_today ?? 0} />
      </div>
    </>
  );
}
const Shortcut = ({ ic, n, l, c }: any) => (
  <div className="card"><div className="shortcut">
    <div className="ic" style={{ color: `var(--${c})` }}>{ic}</div>
    <div><div className="n">{n}</div><div className="l">{l}</div></div>
  </div></div>
);

/* ----------------------------- Live ----------------------------- */
export function Live() {
  const { data, loading, err, reload } = useAsync(() => api.live(), []);
  useEffect(() => { const i = setInterval(reload, 5000); return () => clearInterval(i); }, [reload]);
  const freshDrivers = (data?.drivers || []).filter(hasFreshGps);
  const staleDrivers = [...(data?.stale_drivers || []), ...(data?.drivers || []).filter((d: any) => !freshDrivers.includes(d))];
  return (
    <>
      <PageHead title="Live drift" sub={data ? `Oppdatert ${fmtDate(data.as_of)} · auto hvert 5s` : ''}
        right={<Btn variant="sm" onClick={reload}>Oppdater</Btn>} />
      <ErrorBanner msg={err} />
      {loading && !data ? <Loader /> : (
        <>
        <LiveMap drivers={freshDrivers.map((d: any) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }))} />
        <div className="grid live-columns">
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Sjåfører med fersk GPS ({freshDrivers.length})</div>
            <div className="tablewrap">
              <table><thead><tr><th>Sjåfør</th><th>Kjøretøy</th><th>Løyvehaver</th><th>Sist sett</th></tr></thead>
                <tbody>
                  {freshDrivers.map((x: any) => (
                    <tr key={x.id}><td className="strong">{x.name}</td>
                      <td>{x.car} <span className="dim mono">{x.plate}</span></td>
                      <td className="dim">{x.fleet_name || '—'}</td>
                      <td className="dim nowrap">{fmtDate(x.last_location_at)}</td></tr>
                  ))}
                  {!freshDrivers.length && <tr><td colSpan={4}><Empty title="Ingen sjåfører med fersk posisjon" /></td></tr>}
                </tbody></table>
            </div>
          </div>
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Åpne turer ({data?.trips?.length || 0})</div>
            <div className="tablewrap">
              <table><thead><tr><th>Status</th><th>Rute</th><th>Sjåfør</th><th className="right">Pris</th></tr></thead>
                <tbody>
                  {(data?.trips || []).map((x: any) => (
                    <tr key={x.trip_id}><td><Pill status={x.status} />
                      {x.created_at && Date.now() - Date.parse(x.created_at) > 2 * 60 * 60_000 &&
                        <div className="cell-sub" style={{ color: 'var(--amber)' }}>Åpen over 2 timer · undersøk</div>}</td>
                      <td><div>{x.pickup_address}</div><div className="cell-sub">→ {x.dropoff_address}</div></td>
                      <td>{x.driver_name || <span className="dim">—</span>}</td>
                      <td className="right mono">{fmtMoney(x.price)}</td></tr>
                  ))}
                  {!data?.trips?.length && <tr><td colSpan={4}><Empty title="Ingen aktive turer" /></td></tr>}
                </tbody></table>
            </div>
          </div>
        </div>
        {staleDrivers.length > 0 && <div className="live-stale-note">
          {staleDrivers.length} sjåfør{staleDrivers.length === 1 ? '' : 'er'} har utdatert eller manglende GPS og telles ikke som online.
        </div>}
        </>
      )}
    </>
  );
}

/* ----------------------------- Trips ----------------------------- */
export function Trips() {
  const [sp] = useSearchParams();
  const [status, setStatus] = useState('');
  const [qi, setQi] = useState(sp.get('q') || '');
  const q = useDebounced(qi);
  const [df, setDf] = useState('');
  const [dt, setDt] = useState('');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<any>(null);
  useEffect(() => { setPage(1); }, [status, q, df, dt, pay]);
  const { rows, total, totalPages, loading, err } = usePaged('/admin/trips-full',
    { status, q, date_from: df, date_to: dt, payment_status: pay, page, page_size: PAGE });

  return (
    <>
      <PageHead title="Turer" sub={`${total} turer`} />
      <div className="toolbar">
        <input className="input" placeholder="Søk turID / adresse…" value={qi} onChange={(e) => setQi(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alle statuser</option><option value="active">Aktive</option>
          <option value="completed">Fullførte</option><option value="cancelled">Avbrutte</option>
        </select>
        <select className="select" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">Alle betalinger</option><option value="captured">Betalt</option>
          <option value="pending">Venter</option><option value="failed">Feilet</option>
        </select>
        <input className="input" type="date" value={df} onChange={(e) => setDf(e.target.value)} />
        <input className="input" type="date" value={dt} onChange={(e) => setDt(e.target.value)} />
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Tur</th><th>Rute</th><th>Kunde</th><th>Sjåfør</th><th>Status</th><th className="right">Pris</th><th>Tid</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loader /></td></tr> : rows.length ? rows.map((t: any) => (
              <tr key={t.trip_id} className="click" onClick={() => setSel(t)}>
                <td className="mono dim">{String(t.trip_id).slice(0, 6)}</td>
                <td><div>{t.pickup_address}</div><div className="cell-sub">→ {t.dropoff_address}</div></td>
                <td>{t.passenger_name || '—'}</td>
                <td>{t.driver_name || <span className="dim">—</span>}</td>
                <td><Pill status={t.status} /></td>
                <td className="right mono">{fmtMoney(t.price)}</td>
                <td className="dim nowrap">{fmtDate(t.created_at)}</td>
              </tr>
            )) : <tr><td colSpan={7}><Empty title="Ingen turer funnet" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
      {sel && <TripDrawer trip={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function TripDrawer({ trip, onClose }: any) {
  const tl = useAsync(() => api.timeline(trip.trip_id), [trip.trip_id]);
  const ev = tl.data?.events || [];
  return (
    <Drawer title={`Tur ${String(trip.trip_id).slice(0, 8)}`} onClose={onClose}>
      <div style={{ marginBottom: 14 }}><Pill status={trip.status} /></div>
      <Card style={{ marginBottom: 16 }}><RouteView from={trip.pickup_address} to={trip.dropoff_address} /></Card>
      <KV k="Pris" v={<span className="mono">{fmtMoney(trip.price)}</span>} />
      <KV k="Sjåførandel" v={<span className="mono">{fmtMoney(trip.driver_earnings)}</span>} />
      <KV k="Distanse / tid" v={`${trip.distance_km ?? '—'} km · ${trip.duration_min ?? '—'} min`} />
      <KV k="Kunde" v={trip.passenger_name} />
      <KV k="Sjåfør" v={trip.driver_name ? `${trip.driver_name} · ${trip.driver_car || ''} ${trip.driver_plate || ''}` : '—'} />
      <KV k="Betaling" v={<Pill status={trip.payment_status || 'pending'} />} />
      <KV k="Kjøretøyklasse" v={trip.vehicle_type} />
      <KV k="Vurdering" v={trip.passenger_rating ? `${trip.passenger_rating} ★` : '—'} />
      <KV k="Opprettet" v={fmtDate(trip.created_at)} />

      <div className="section-title">Hendelsesforløp</div>
      {tl.loading ? <Loader /> : ev.length ? (
        <div className="tl">
          {ev.map((e: any, i: number) => (
            <div className="tl-item" key={i}>
              <div className="tl-time">{fmtDate(e.at || e.time || e.ts)}</div>
              <div className="tl-label">{e.label || e.event || e.description || e.status || '—'}</div>
            </div>
          ))}
        </div>
      ) : <Empty title="Ingen registrerte hendelser" />}
    </Drawer>
  );
}

/* ----------------------------- Drivers ----------------------------- */
export function Drivers() {
  const [sp] = useSearchParams();
  const [status, setStatus] = useState('');
  const [qi, setQi] = useState(sp.get('q') || '');
  const q = useDebounced(qi);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status, q]);
  const { rows, total, totalPages, loading, err, reload } = usePaged('/admin/drivers-full', { status, q, page, page_size: PAGE });

  const toggle = async (d: any) => {
    const next = !d.approved;
    if (!window.confirm(next ? `Godkjenne ${d.name}?` : `Suspendere ${d.name}?`)) return;
    try { await api.setDriverStatus(d.id, next); reload(); } catch (e: any) { alert(e?.response?.data?.detail || 'Feil'); }
  };

  return (
    <>
      <PageHead title="Sjåfører" sub={`${total} sjåfører`} />
      <div className="toolbar">
        <input className="input" placeholder="Søk navn / e-post / skilt…" value={qi} onChange={(e) => setQi(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alle</option><option value="approved">Godkjente</option>
          <option value="pending">Til godkjenning</option><option value="online">Online</option>
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Sjåfør</th><th>Kjøretøy</th><th>Løyvehaver</th><th>Turer</th><th>Vurd.</th><th>Status</th><th className="right">Handling</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loader /></td></tr> : rows.length ? rows.map((d: any) => (
              <tr key={d.id}>
                <td><div className="strong">{d.name}</div><div className="cell-sub">{d.email}</div></td>
                <td>{d.car || '—'} <span className="dim mono">{d.plate}</span></td>
                <td className="dim">{d.fleet_name || '—'}</td>
                <td className="mono">{d.trips_completed ?? d.completed ?? 0}</td>
                <td className="mono">{d.rating ? `${d.rating}★` : '—'}</td>
                <td>{d.online && hasRecentSignal(d.last_location_at) ? <Pill status="in_trip" label="Online" /> : d.approved ? <Pill status="completed" label="Godkjent · offline" /> : <Pill status="pending" label="Venter" />}</td>
                <td className="right">
                  <Btn variant={`sm ${d.approved ? 'danger' : 'primary'}`} onClick={() => toggle(d)}>
                    {d.approved ? 'Suspender' : 'Godkjenn'}
                  </Btn>
                </td>
              </tr>
            )) : <tr><td colSpan={7}><Empty title="Ingen sjåfører" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

/* ----------------------------- Customers ----------------------------- */
export function Customers() {
  const [sp] = useSearchParams();
  const [qi, setQi] = useState(sp.get('q') || '');
  const q = useDebounced(qi);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, status]);
  const { rows, total, totalPages, loading, err } = usePaged('/admin/users', { q, status, page, page_size: PAGE });
  return (
    <>
      <PageHead title="Kunder & brukere" sub={`${total} brukere`} />
      <div className="toolbar">
        <input className="input" placeholder="Søk navn / e-post / telefon…" value={qi} onChange={(e) => setQi(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alle</option><option value="active">Aktive</option><option value="disabled">Deaktiverte</option>
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Navn</th><th>E-post</th><th>Telefon</th><th>Rolle</th><th>Registrert</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5}><Loader /></td></tr> : rows.length ? rows.map((u: any) => (
              <tr key={u.id}>
                <td className="strong">{u.fullName || '—'}</td>
                <td className="dim">{u.email}</td>
                <td className="mono">{u.phone || '—'}</td>
                <td><Pill status="gray" label={u.role || 'kunde'} /></td>
                <td className="dim nowrap">{fmtDay(u.created_at)}</td>
              </tr>
            )) : <tr><td colSpan={5}><Empty title="Ingen brukere" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

/* ----------------------------- Fleets ----------------------------- */
export function Fleets() {
  const { data, loading, err } = useAsync(() => api.list('/admin/fleets-full', {}), []);
  const fleets = data?.fleets || data?.items || [];
  return (
    <>
      <PageHead title="Løyvehavere" sub={`${fleets.length} løyvehavere`} />
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Selskap</th><th>Org.nr</th><th>Sjåfører</th><th>Provisjon</th><th className="right">Omsetning</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : fleets.length ? fleets.map((f: any) => (
              <tr key={f.id}>
                <td className="strong">{f.name}</td>
                <td className="mono dim">{f.org_number || '—'}</td>
                <td className="mono">{f.drivers ?? f.driver_count ?? '—'}</td>
                <td className="mono">{f.commission_rate != null ? Math.round(f.commission_rate * 100) + '%' : '—'}</td>
                <td className="right mono">{f.gmv != null ? fmtMoney(f.gmv) : (f.revenue != null ? fmtMoney(f.revenue) : '—')}</td>
                <td><Pill status={f.status === 'suspended' ? 'cancelled' : 'completed'} label={f.status === 'suspended' ? 'Suspendert' : 'Aktiv'} /></td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen løyvehavere" /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ----------------------------- Vehicles ----------------------------- */
export function Vehicles() {
  const [sp] = useSearchParams();
  const [qi, setQi] = useState(sp.get('q') || '');
  const q = useDebounced(qi);
  const [vt, setVt] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, vt]);
  const { rows, total, totalPages, loading, err } = usePaged('/admin/vehicles', { q, vehicle_type: vt, page, page_size: PAGE });
  return (
    <>
      <PageHead title="Kjøretøy" sub={`${total} kjøretøy`} />
      <div className="toolbar">
        <input className="input" placeholder="Søk skilt / modell / sjåfør…" value={qi} onChange={(e) => setQi(e.target.value)} />
        <select className="select" value={vt} onChange={(e) => setVt(e.target.value)}>
          <option value="">Alle klasser</option><option value="ai-first">KJAPP</option>
          <option value="enkelt">Enkel</option><option value="trygg">Komfort XL</option><option value="premium">Premium</option>
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Skilt</th><th>Modell</th><th>Klasse</th><th>Sjåfør</th><th>Løyvehaver</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : rows.length ? rows.map((v: any) => (
              <tr key={v.id}>
                <td className="mono strong">{v.plate || '—'}</td>
                <td>{v.car || '—'}</td>
                <td className="dim">{v.vehicle_type || '—'}</td>
                <td>{v.driver_name || '—'}</td>
                <td className="dim">{v.fleet_name || '—'}</td>
                <td>{v.online && hasRecentSignal(v.last_location_at) ? <Pill status="in_trip" label="Online" /> : <Pill status={v.approved ? 'completed' : 'pending'} label={v.approved ? 'Godkjent · offline' : 'Venter'} />}</td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen kjøretøy" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

/* ----------------------------- Documents ----------------------------- */
export function Documents() {
  const [scope, setScope] = useState('');
  const [qi, setQi] = useState('');
  const q = useDebounced(qi);
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState<any>(null);
  useEffect(() => { setPage(1); }, [scope, q]);
  const { rows, total, totalPages, loading, err, extra, reload } = usePaged('/admin/documents', { scope, q, page, page_size: PAGE });
  const sm = extra?.summary || {};
  return (
    <>
      <PageHead title="Dokumenter & compliance" sub={`${total} dokumenter`} />
      <div className="grid cards" style={{ marginBottom: 14 }}>
        <Kpi label="Gyldige" value={sm.VALID ?? 0} />
        <Kpi label="Utløper snart" value={sm.EXPIRING ?? 0} accent />
        <Kpi label="Utløpt" value={sm.EXPIRED ?? 0} />
        <Kpi label="Til vurdering" value={(sm.PENDING ?? 0)} />
      </div>
      <div className="toolbar">
        <input className="input" placeholder="Søk filnavn…" value={qi} onChange={(e) => setQi(e.target.value)} />
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Alle typer</option>
          {(extra?.scopes || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Fil</th><th>Type</th><th>Eier</th><th>Utløp</th><th>Status</th><th className="right">Handling</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : rows.length ? rows.map((d: any) => (
              <tr key={d.id}>
                <td>{d.filename || '—'}</td>
                <td className="dim">{d.scope}</td>
                <td>{d.owner_name || d.owner_email || '—'}</td>
                <td className="dim nowrap">{d.expiry ? fmtDay(d.expiry) : '—'}</td>
                <td><Pill status={d.compliance} /></td>
                <td className="right"><Btn variant="sm" onClick={() => setRev(d)}>Vurder</Btn></td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen dokumenter" sub="Dokumenter dukker opp her når sjåfører/løyvehavere laster opp." /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
      {rev && <ReviewModal doc={rev} onClose={() => setRev(null)} onDone={() => { setRev(null); reload(); }} />}
    </>
  );
}

function ReviewModal({ doc, onClose, onDone }: any) {
  const [status, setStatus] = useState(doc.review_status === 'valid' ? 'valid' : 'valid');
  const [expiry, setExpiry] = useState(doc.expiry || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.reviewDoc(doc.id, { status, expiry: expiry || null, reason: reason || null }); onDone(); }
    catch (e: any) { setErr(e?.response?.data?.detail || 'Feil'); setBusy(false); }
  };
  return (
    <Modal title="Vurder dokument" sub={doc.filename} onClose={onClose}>
      {err && <div className="error-banner">{err}</div>}
      <div className="field"><label className="label">Status</label>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="valid">Godkjenn (gyldig)</option>
          <option value="rejected">Avvis</option>
          <option value="pending">Sett til venter</option>
        </select>
      </div>
      {status === 'valid' && (
        <div className="field"><label className="label">Utløpsdato (valgfritt)</label>
          <input className="input" type="date" value={expiry || ''} onChange={(e) => setExpiry(e.target.value)} /></div>
      )}
      <div className="field"><label className="label">Begrunnelse (valgfritt)</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="F.eks. uleselig / utløpt" /></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn className="full" onClick={onClose}>Avbryt</Btn>
        <Btn variant="primary" className="full" onClick={save} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre'}</Btn>
      </div>
    </Modal>
  );
}

/* ----------------------------- Finance ----------------------------- */
export function Finance() {
  const [tab, setTab] = useState<'overview' | 'tx' | 'refunds'>('overview');
  return (
    <>
      <PageHead title="Økonomi" right={
        <div className="segs">
          {[['overview', 'Oversikt'], ['tx', 'Transaksjoner'], ['refunds', 'Refusjoner']].map(([k, l]) => (
            <div key={k} className={`seg ${tab === k ? 'active' : ''}`} onClick={() => setTab(k as any)}>{l}</div>
          ))}
        </div>} />
      {tab === 'overview' && <FinanceOverview />}
      {tab === 'tx' && <Transactions />}
      {tab === 'refunds' && <Refunds />}
    </>
  );
}

function FinanceOverview() {
  const [days, setDays] = useState(30);
  const { data, loading, err } = useAsync(() => api.finance(days), [days]);
  const t = data?.totals || {};
  return (
    <>
      <div className="toolbar">
        <div className="segs">{[7, 30, 90].map((d) => (
          <div key={d} className={`seg ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>{d} dager</div>
        ))}</div>
      </div>
      <ErrorBanner msg={err} />
      {loading ? <Loader /> : (
        <>
          <div className="grid cards">
            <Kpi label="Brutto omsetning" value={fmtMoney(t.gmv)} accent />
            <Kpi label="KJAPP-inntekt" value={fmtMoney(t.kjapp_revenue)} accent />
            <Kpi label="Turer" value={t.trips ?? 0} />
            <Kpi label="Snittpris" value={fmtMoney(t.avg_price)} />
          </div>
          <div className="section-title">Omsetning per dag</div>
          <Card><Bars data={data?.series || []} xkey="date" ykey="gmv" /></Card>
          <div className="section-title">Per løyvehaver</div>
          <div className="tablewrap">
            <table><thead><tr><th>Løyvehaver</th><th>Turer</th><th>Provisjon</th><th className="right">Omsetning</th><th className="right">KJAPP-provisjon</th></tr></thead>
              <tbody>
                {(data?.fleets || []).map((f: any) => (
                  <tr key={f.id}><td className="strong">{f.name}</td><td className="mono">{f.trips}</td>
                    <td className="mono">{Math.round((f.commission_rate || 0) * 100)}%</td>
                    <td className="right mono">{fmtMoney(f.gmv)}</td>
                    <td className="right mono">{fmtMoney(f.commission_amount)}</td></tr>
                ))}
                {!data?.fleets?.length && <tr><td colSpan={5}><Empty title="Ingen omsetning i perioden" /></td></tr>}
              </tbody></table>
          </div>
        </>
      )}
    </>
  );
}

function Transactions() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [type]);
  const { rows, total, totalPages, loading, err } = usePaged('/admin/transactions', { type, page, page_size: PAGE });
  return (
    <>
      <div className="toolbar">
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Alle typer</option><option value="FARE">Turbetaling</option>
          <option value="REFUND">Refusjon</option><option value="PAYOUT">Utbetaling</option>
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Type</th><th>Ref.</th><th>Motpart</th><th>Leverandør</th><th>Status</th><th className="right">Beløp</th><th>Tid</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loader /></td></tr> : rows.length ? rows.map((r: any) => (
              <tr key={r.id}>
                <td><Pill status="gray" label={r.type} /></td>
                <td className="mono dim">{r.ride ? String(r.ride).slice(0, 6) : (r.recipient || '—')}</td>
                <td>{r.customer_name || r.driver_name || r.recipient || '—'}</td>
                <td className="dim">{r.provider || '—'}</td>
                <td><Pill status={r.status} /></td>
                <td className="right mono" style={{ color: r.amount < 0 ? 'var(--red)' : 'var(--text)' }}>{fmtMoney(r.amount)}</td>
                <td className="dim nowrap">{fmtDate(r.timestamp)}</td>
              </tr>
            )) : <tr><td colSpan={7}><Empty title="Ingen transaksjoner" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

function Refunds() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { rows, total, totalPages, loading, err, reload } = usePaged('/admin/refunds', { page, page_size: PAGE });
  return (
    <>
      <div className="toolbar"><div className="spacer" /><Btn variant="primary" onClick={() => setOpen(true)}>+ Ny refusjon</Btn></div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Tur</th><th>Begrunnelse</th><th>Leverandør</th><th>Status</th><th className="right">Beløp</th><th>Tid</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : rows.length ? rows.map((r: any) => (
              <tr key={r.id}>
                <td className="mono dim">{String(r.trip_id).slice(0, 6)}</td>
                <td>{r.reason}</td>
                <td className="dim">{r.provider}</td>
                <td><Pill status={r.status} /></td>
                <td className="right mono">{fmtMoney(r.amount)}</td>
                <td className="dim nowrap">{fmtDate(r.created_at)}</td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen refusjoner" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
      {open && <RefundModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function RefundModal({ onClose, onDone }: any) {
  const [tripId, setTripId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api.refund({ trip_id: tripId.trim(), amount: amount ? Number(amount) : undefined, reason: reason.trim() });
      onDone();
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Feil'); setBusy(false); }
  };
  return (
    <Modal title="Ny refusjon" sub="Refusjonen logges og er idempotent (ingen dobbel refusjon)." onClose={onClose}>
      {err && <div className="error-banner">{err}</div>}
      <div className="field"><label className="label">Tur-ID</label>
        <input className="input mono" value={tripId} onChange={(e) => setTripId(e.target.value)} placeholder="fullstendig trip_id" /></div>
      <div className="field"><label className="label">Beløp (kr, tomt = full refusjon)</label>
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="f.eks. 50" /></div>
      <div className="field"><label className="label">Begrunnelse</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Årsak til refusjon" /></div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn className="full" onClick={onClose}>Avbryt</Btn>
        <Btn variant="primary" className="full" onClick={save} disabled={busy || !tripId || !reason}>{busy ? 'Behandler…' : 'Refunder'}</Btn>
      </div>
    </Modal>
  );
}

/* ----------------------------- Support ----------------------------- */
export function Support() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status]);
  const { rows, total, totalPages, loading, err, reload } = usePaged('/admin/support/tickets', { status, page, page_size: PAGE });
  const setTicket = async (id: string, s: string) => { try { await api.updateTicket(id, { status: s }); reload(); } catch {} };
  return (
    <>
      <PageHead title="Support" sub={`${total} saker`} />
      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Alle</option><option value="open">Åpne</option>
          <option value="resolved">Løste</option><option value="closed">Lukkede</option>
        </select>
      </div>
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Emne</th><th>Kategori</th><th>Prioritet</th><th>Status</th><th>Opprettet</th><th className="right">Endre</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : rows.length ? rows.map((t: any) => (
              <tr key={t.id}>
                <td className="strong">{t.subject}</td>
                <td className="dim">{t.category}</td>
                <td><Pill status="gray" label={t.priority} /></td>
                <td><Pill status={t.status} /></td>
                <td className="dim nowrap">{fmtDate(t.created_at)}</td>
                <td className="right">
                  <select className="select" style={{ height: 30, width: 'auto' }} value={t.status} onChange={(e) => setTicket(t.id, e.target.value)}>
                    {['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen supportsaker" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

/* ----------------------------- Audit ----------------------------- */
export function Audit() {
  const [page, setPage] = useState(1);
  const { rows, total, totalPages, loading, err } = usePaged('/admin/audit-log', { page, page_size: 50 });
  return (
    <>
      <PageHead title="Audit-logg" sub={`${total} hendelser`} />
      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Tid</th><th>Administrator</th><th>Handling</th><th>Objekt</th><th>Begrunnelse</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5}><Loader /></td></tr> : rows.length ? rows.map((e: any) => (
              <tr key={e.id}>
                <td className="dim nowrap">{fmtDate(e.at)}</td>
                <td>{e.admin_email}</td>
                <td><Pill status="gold" label={e.action} /></td>
                <td className="dim mono">{e.entity_type}:{String(e.entity_id || '').slice(0, 8)}</td>
                <td className="dim">{e.reason || '—'}</td>
              </tr>
            )) : <tr><td colSpan={5}><Empty title="Ingen hendelser" /></td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </>
  );
}

/* ----------------------------- Settings ----------------------------- */
function TwoFactorCard() {
  const status = useAsync(() => api.twofaStatus(), []);
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const begin = async () => {
    setBusy(true); setMsg(''); setBackupCodes([]);
    try { setSetup(await api.twofaSetup()); }
    catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };
  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      const result = await api.twofaEnable(code.trim());
      setBackupCodes(result.backup_codes || []);
      setSetup(null); setCode(''); setMsg('Totrinnsbekreftelse er aktivert. Lagre reservekodene trygt.');
      status.reload();
    } catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setMsg('');
    try {
      await api.twofaDisable(password, code.trim());
      setPassword(''); setCode(''); setMsg('Totrinnsbekreftelse er deaktivert.');
      status.reload();
    } catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <div className="section-title" style={{ marginTop: 0 }}>Kontosikkerhet</div>
      {status.loading ? <Loader /> : status.data?.enabled ? (
        <>
          <Pill status="completed" label="Totrinnsbekreftelse aktiv" />
          <div className="dim" style={{ margin: '12px 0' }}>Passord, autentiseringskode og engangskoder beskytter administratorkontoen.</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 620 }}>
            <div className="field"><label className="label">Nåværende passord</label>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="field"><label className="label">Kode fra autentiseringsappen</label>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} /></div>
          </div>
          <Btn onClick={disable} disabled={busy || !password || !code}>{busy ? 'Arbeider…' : 'Deaktiver 2FA'}</Btn>
        </>
      ) : setup ? (
        <>
          <div className="dim" style={{ marginBottom: 12 }}>Skann QR-koden i en autentiseringsapp og skriv inn den seks-sifrede koden.</div>
          <img src={setup.qr} alt="QR-kode for totrinnsbekreftelse" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 12 }} />
          <div className="mono" style={{ margin: '10px 0 14px', wordBreak: 'break-all' }}>{setup.secret}</div>
          <div className="field" style={{ maxWidth: 320 }}><label className="label">Bekreftelseskode</label>
            <input className="input mono" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} /></div>
          <Btn variant="primary" onClick={enable} disabled={busy || !code}>{busy ? 'Aktiverer…' : 'Aktiver 2FA'}</Btn>
        </>
      ) : (
        <>
          <Pill status="pending" label="Totrinnsbekreftelse er ikke aktiv" />
          <div className="dim" style={{ margin: '12px 0' }}>Aktiver 2FA før panelet brukes med produksjonsdata.</div>
          <Btn variant="primary" onClick={begin} disabled={busy}>{busy ? 'Klargjør…' : 'Sett opp 2FA'}</Btn>
        </>
      )}
      {backupCodes.length > 0 && <div style={{ marginTop: 18 }}>
        <div className="strong">Reservekoder – vises bare nå</div>
        <div className="mono" style={{ marginTop: 8, lineHeight: 1.8 }}>{backupCodes.join('  ·  ')}</div>
      </div>}
      {msg && <div className={msg.includes('aktivert') || msg.includes('deaktivert') ? 'dim' : 'error-banner'} style={{ marginTop: 12 }}>{msg}</div>}
    </Card>
  );
}

export function Settings() {
  const { user } = useAuth();
  const { data, loading, err, reload } = useAsync(() => api.list('/admin/settings', {}), []);
  const [comm, setComm] = useState('');
  const [pricing, setPricing] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [test, setTest] = useState({ distance_km: '10', duration_min: '20', vehicle_type: 'ai-first' });
  const [testResult, setTestResult] = useState<any>(null);
  useEffect(() => {
    if (data?.default_commission != null) setComm(String(Math.round(data.default_commission * 100)));
    if (data?.pricing) setPricing(data.pricing);
  }, [data]);
  const isSuper = user?.role === 'superadmin';
  const rideClasses = Array.isArray(data?.ride_classes)
    ? data.ride_classes
    : Object.entries(data?.ride_classes || {}).map(([type, value]: [string, any]) => ({ type, ...(value || {}) }));
  const setPrice = (key: string, value: any) => setPricing((p: any) => ({ ...p, [key]: value }));
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await api.patchSettings({ default_commission: Number(comm) / 100, pricing });
      setMsg('Lagret – nye bestillinger bruker ny prisversjon. Pågående turer beholder sitt snapshot.');
      reload();
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Feil'); }
    finally { setBusy(false); }
  };
  const runTest = async () => {
    setTestResult(null);
    try {
      const r = await api.post('/admin/pricing/test', {
        distance_km: Number(test.distance_km), duration_min: Number(test.duration_min), vehicle_type: test.vehicle_type,
      });
      setTestResult(r);
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Kunne ikke teste pris'); }
  };
  if (loading) return <Loader />;
  const fields = [
    ['base_fare','Grunnpris'], ['per_km','Pris per km'], ['per_minute','Pris per minutt'],
    ['waiting_per_minute','Ventetid per minutt'], ['minimum_fare','Minimumspris'],
    ['extra_stop_fee','Ekstra stopp'], ['customer_cancellation_fee','Avbestillingsgebyr kunde'],
    ['late_driver_cancellation_fee','Sen avbestilling sjåfør'],
  ];
  return (
    <>
      <PageHead title="Innstillinger" sub={`Sist oppdatert ${fmtDate(data?.updated_at)} · prisversjon ${pricing?.version || 1}`} />
      <ErrorBanner msg={err} />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 980 }}>
        <TwoFactorCard />
        <Card>
          <div className="section-title" style={{ marginTop: 0 }}>Provisjon</div>
          <div className="field"><label className="label">Standard KJAPP-provisjon (%)</label>
            <input className="input" type="number" min="0" max="50" value={comm} disabled={!isSuper} onChange={(e) => setComm(e.target.value)} /></div>
          <div className="dim" style={{ fontSize: 12 }}>Endringer er begrenset til superadmin og logges.</div>
        </Card>
      </div>

      <div className="section-title">Dynamisk prissetting</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {fields.map(([key,label]) => <div className="field" key={key}>
            <label className="label">{label} (NOK)</label>
            <input className="input" type="number" min="0" step="0.5" value={pricing?.[key] ?? ''}
              disabled={!isSuper} onChange={(e) => setPrice(key, Number(e.target.value))} />
          </div>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12 }}>
          <div className="field"><label className="label">Toppris aktiv</label>
            <select className="input" disabled={!isSuper} value={pricing?.surge?.enabled ? 'on':'off'}
              onChange={(e) => setPrice('surge',{...(pricing?.surge||{}),enabled:e.target.value==='on'})}>
              <option value="on">På</option><option value="off">Av</option>
            </select></div>
          <div className="field"><label className="label">Manuell toppris ×</label>
            <input className="input" type="number" min="1" max="5" step="0.05" disabled={!isSuper}
              value={pricing?.surge?.manual_multiplier ?? 1}
              onChange={(e) => setPrice('surge',{...(pricing?.surge||{}),manual_multiplier:Number(e.target.value)})}/></div>
          <div className="field"><label className="label">Maks toppris ×</label>
            <input className="input" type="number" min="1" max="5" step="0.05" disabled={!isSuper}
              value={pricing?.surge?.max_multiplier ?? 2}
              onChange={(e) => setPrice('surge',{...(pricing?.surge||{}),max_multiplier:Number(e.target.value)})}/></div>
        </div>
        {isSuper ? <Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre prisregler'}</Btn>
          : <div className="dim" style={{ fontSize: 12 }}>Kun superadmin kan endre priser.</div>}
        {msg && <div style={{ marginTop: 10, color: msg.startsWith('Lagret') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{msg}</div>}
      </Card>

      <div className="section-title">Test pris før publisering</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
          <div className="field"><label className="label">Distanse (km)</label><input className="input" type="number" value={test.distance_km} onChange={e=>setTest({...test,distance_km:e.target.value})}/></div>
          <div className="field"><label className="label">Tid (min)</label><input className="input" type="number" value={test.duration_min} onChange={e=>setTest({...test,duration_min:e.target.value})}/></div>
          <div className="field"><label className="label">Kategori</label><select className="input" value={test.vehicle_type} onChange={e=>setTest({...test,vehicle_type:e.target.value})}>
            <option value="ai-first">Standard</option><option value="enkelt">Sparsom</option><option value="trygg">Komfort</option><option value="premium">Premium</option>
          </select></div>
          <Btn onClick={runTest}>Beregn</Btn>
        </div>
        {testResult && <div className="strong" style={{ marginTop: 12 }}>{testResult.price} kr · toppris ×{testResult.surge_multiplier} · versjon {testResult.pricing_version}</div>}
      </Card>

      <div className="section-title">Kjøretøyklasser</div>
      <Card><div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {rideClasses.map((r: any, i: number) => <div key={r.type || i}><div className="strong">{r.label || r.name || r.type}</div>
          <div className="dim" style={{ fontSize: 12 }}>×{r.multiplier ?? r.price_multiplier ?? 1}</div></div>)}
      </div></Card>
    </>
  );
}
