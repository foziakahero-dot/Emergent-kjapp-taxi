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
  const health = useAsync(() => api.betaHealth(7), []);
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

      <Card style={{ marginBottom: 18, border: '1px solid rgba(45,212,191,.28)', boxShadow: '0 0 28px rgba(45,212,191,.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 720 }}>
            <div className="dim" style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>KJAPP · Beta Operations 2.0</div>
            <div className="strong" style={{ fontSize: 20, marginBottom: 6 }}>Nytt operatør- og priskontrollsenter er aktivt</div>
            <div className="dim" style={{ lineHeight: 1.55 }}>
              Dynamisk prissetting, prisområder, rollback, operatørinngripen på aktive turer,
              sjåførutstyr og 10 % serviceavgift er samlet i kontrollsenteret.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn primary" href="#/pricing">Åpne prissetting</a>
            <a className="btn" href="#/trips">Operatørkontroll</a>
            <a className="btn" href="#/drivers">Sjåførutstyr</a>
          </div>
        </div>
      </Card>

      <div className="grid cards">
        <Kpi label="Åpne turer" value={d.trips?.active ?? 0} accent
          foot={<span className="dim">{live.loading ? 'Kontrollerer GPS…' : live.err ? 'GPS-status utilgjengelig' : `${freshCount} sjåfører med fersk GPS`}{staleOpen ? ` · ${staleOpen} turer eldre enn 2t` : ''}</span>} />
        <Kpi label="Turer i dag" value={d.trips?.today ?? 0}
          foot={<span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs i går</span>} />
        <Kpi label="Brutto i dag (GMV)" value={fmtMoney(d.finance?.gmv_today)}
          foot={<span className="dim">{d.trips?.completed_today ?? 0} fullført</span>} />
        <Kpi label="KJAPP-inntekt i dag" value={fmtMoney(d.finance?.kjapp_revenue_today)} accent />
      </div>

      <div className="section-title">Beta Health · siste 7 dager</div>
      <div className="grid cards">
        <Kpi label="Completion" value={health.loading ? '…' : health.err ? '—' : health.data?.trips?.completion_rate_pct == null ? '—' : `${health.data.trips.completion_rate_pct}%`}
          foot={<span className="dim">{health.data ? `${health.data.trips.completed}/${health.data.trips.requested} fullført` : 'Ekte turdata'}</span>} />
        <Kpi label="Dispatch success" value={health.loading ? '…' : health.err ? '—' : health.data?.dispatch?.success_rate_pct == null ? '—' : `${health.data.dispatch.success_rate_pct}%`}
          foot={<span className="dim">{health.data ? `${health.data.dispatch.assigned}/${health.data.trips.requested} tildelt` : 'Sjåførtilordning'}</span>} />
        <Kpi label="Median accept" value={health.loading ? '…' : health.err ? '—' : health.data?.dispatch?.median_accept_seconds == null ? '—' : `${Math.round(health.data.dispatch.median_accept_seconds)}s`}
          foot={<span className="dim">{health.data?.dispatch?.p95_accept_seconds != null ? `p95 ${Math.round(health.data.dispatch.p95_accept_seconds)}s` : 'Venter på nok turer'}</span>} />
        <Kpi label="GPS freshness" value={health.loading ? '…' : health.err ? '—' : health.data?.gps?.freshness_pct == null ? '—' : `${health.data.gps.freshness_pct}%`}
          foot={<span className="dim">{health.data ? `${health.data.gps.fresh_drivers}/${health.data.gps.online_drivers} online · ${health.data.client_errors.fatal} fatale klientfeil` : 'Aktive sjåfører'}</span>} />
      </div>
      {health.err ? <ErrorBanner msg={health.err} /> : null}

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
  const { rows, total, totalPages, loading, err, reload } = usePaged('/admin/trips-full',
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
      {sel && <TripDrawer trip={sel} onClose={() => setSel(null)} onChanged={async () => { await reload(); setSel(null); }} />}
    </>
  );
}

function TripDrawer({ trip, onClose, onChanged }: any) {
  const tl = useAsync(() => api.timeline(trip.trip_id), [trip.trip_id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ev = tl.data?.events || [];
  const active = ['searching','booking','driver_on_way','at_pickup','in_trip'].includes(trip.status);
  const canRelease = ['driver_on_way','at_pickup'].includes(trip.status) && !!trip.driver_name;
  const isPaid = ['paid','captured'].includes(String(trip.payment_status || '').toLowerCase());

  const intervene = async (action: 'cancel_active' | 'release_driver' | 'adjust_price') => {
    const labels: Record<string,string> = {
      cancel_active: 'avbryte turen',
      release_driver: 'frigjøre sjåføren og søke på nytt',
      adjust_price: 'justere turprisen',
    };
    let price: number | undefined;
    if (action === 'adjust_price') {
      const raw = window.prompt('Ny turpris i kroner:', String(trip.price ?? ''));
      if (raw == null) return;
      price = Number(raw);
      if (!Number.isFinite(price) || price < 0 || price > 100000) {
        window.alert('Oppgi en gyldig pris mellom 0 og 100 000 kr.');
        return;
      }
    }
    const reason = window.prompt(`Begrunnelse for å ${labels[action]} (lagres i revisjonsloggen):`, '') || '';
    if (reason.trim().length < 3) return;
    if (!window.confirm(`Bekreft: ${labels[action]}?`)) return;
    setBusy(true); setMsg('');
    try {
      await api.interveneTrip(trip.trip_id, { action, reason: reason.trim(), ...(price != null ? { price: Math.round(price) } : {}) });
      setMsg('Operatørhandlingen er gjennomført og logget.');
      await onChanged?.();
    } catch (e: any) {
      setMsg(apiError(e));
    } finally { setBusy(false); }
  };

  const refund = async () => {
    const raw = window.prompt('Beløp som skal refunderes i kroner (tomt = maksimalt tilgjengelig):', '');
    if (raw == null) return;
    const amount = raw.trim() ? Number(raw) : undefined;
    if (amount != null && (!Number.isFinite(amount) || amount <= 0 || amount > Number(trip.price || 0))) {
      window.alert('Oppgi et gyldig refusjonsbeløp.');
      return;
    }
    const reason = window.prompt('Begrunnelse for refundering (lagres i revisjonsloggen):', '') || '';
    if (reason.trim().length < 3) return;
    if (!window.confirm('Bekreft refundering?')) return;
    setBusy(true); setMsg('');
    try {
      await api.refund({ trip_id: trip.trip_id, ...(amount != null ? { amount: Math.round(amount) } : {}), reason: reason.trim() });
      setMsg('Refunderingen er registrert.');
      await onChanged?.();
    } catch (e: any) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };

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
      <KV k="Prisversjon" v={trip.pricing_version ?? '—'} />
      <KV k="Serviceavgift" v={trip.commission_rate != null ? `${Math.round(Number(trip.commission_rate) * 1000) / 10}%` : '—'} />
      {!!trip.special_needs?.length && <KV k="Spesielle behov" v={trip.special_needs.join(' · ')} />}
      {!!trip.stops?.length && <KV k="Ekstra stopp" v={String(trip.stops.length)} />}
      <KV k="Vurdering" v={trip.passenger_rating ? `${trip.passenger_rating} ★` : '—'} />
      <KV k="Opprettet" v={fmtDate(trip.created_at)} />

      <div className="section-title">Operatørkontroll</div>
      <Card style={{ marginBottom: 16 }}>
        <div className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
          Handlinger logges i revisjonsloggen. Betalte turer kan ikke få omskrevet pris; bruk refundering.
        </div>
        {trip.requires_manual_settlement ? <div className="error-banner" style={{ marginBottom: 10 }}>Denne turen krever manuelt oppgjør etter avbrudd.</div> : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canRelease ? <Btn disabled={busy} onClick={() => intervene('release_driver')}>Finn ny sjåfør</Btn> : null}
          {active ? <Btn variant="danger" disabled={busy} onClick={() => intervene('cancel_active')}>Avbryt tur</Btn> : null}
          {!isPaid ? <Btn disabled={busy} onClick={() => intervene('adjust_price')}>Juster pris</Btn> : null}
          {isPaid ? <Btn disabled={busy} onClick={refund}>Refunder</Btn> : null}
        </div>
        {msg ? <div className={msg.includes('gjennomført') || msg.includes('registrert') ? 'ok-banner' : 'error-banner'} style={{ marginTop: 10 }}>{msg}</div> : null}
      </Card>

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

  const toggleCapability = async (d: any, capability: 'wheelchair' | 'child_seat') => {
    const current = Array.isArray(d.capabilities) ? d.capabilities : [];
    const next = current.includes(capability) ? current.filter((x: string) => x !== capability) : [...current, capability];
    try { await api.setDriverCapabilities(d.id, next); await reload(); }
    catch (e: any) { window.alert(apiError(e)); }
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
          <thead><tr><th>Sjåfør</th><th>Kjøretøy</th><th>Utstyr</th><th>Løyvehaver</th><th>Turer</th><th>Vurd.</th><th>Status</th><th className="right">Handling</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><Loader /></td></tr> : rows.length ? rows.map((d: any) => (
              <tr key={d.id}>
                <td><div className="strong">{d.name}</div><div className="cell-sub">{d.email}</div></td>
                <td>{d.car || '—'} <span className="dim mono">{d.plate}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn variant="sm" onClick={() => toggleCapability(d, 'wheelchair')}>
                      {(d.capabilities || []).includes('wheelchair') ? '✓ Rullestol' : '+ Rullestol'}
                    </Btn>
                    <Btn variant="sm" onClick={() => toggleCapability(d, 'child_seat')}>
                      {(d.capabilities || []).includes('child_seat') ? '✓ Barnesete' : '+ Barnesete'}
                    </Btn>
                  </div>
                </td>
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
            )) : <tr><td colSpan={8}><Empty title="Ingen sjåfører" /></td></tr>}
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
  const [busyUser, setBusyUser] = useState('');
  useEffect(() => { setPage(1); }, [q, status]);
  const { rows, total, totalPages, loading, err, reload } = usePaged('/admin/users', { q, status, page, page_size: PAGE });

  const toggleUser = async (u: any) => {
    const disabling = !u.disabled;
    let reason = '';
    if (disabling) {
      reason = window.prompt('Årsak til deaktivering (lagres i revisjonslogg):', '') || '';
      if (!reason.trim()) return;
      if (!window.confirm(`Deaktiver ${u.fullName || u.email}? Eksisterende økter blir avsluttet.`)) return;
    } else if (!window.confirm(`Reaktiver ${u.fullName || u.email}?`)) return;
    setBusyUser(u.id);
    try { await api.setUserStatus(u.id, disabling, reason); await reload(); }
    catch (e: any) { window.alert(apiError(e)); }
    finally { setBusyUser(''); }
  };

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
          <thead><tr><th>Navn</th><th>E-post</th><th>Telefon</th><th>Rolle</th><th>Status</th><th>Registrert</th><th className="right">Handling</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loader /></td></tr> : rows.length ? rows.map((u: any) => (
              <tr key={u.id}>
                <td className="strong">{u.fullName || '—'}</td>
                <td className="dim">{u.email}</td>
                <td className="mono">{u.phone || '—'}</td>
                <td><Pill status="gray" label={u.role || 'kunde'} /></td>
                <td><Pill status={u.disabled ? 'cancelled' : 'completed'} label={u.disabled ? 'Deaktivert' : 'Aktiv'} /></td>
                <td className="dim nowrap">{fmtDay(u.created_at)}</td>
                <td className="right">
                  {u.role === 'passenger' || !u.role || u.role === 'customer'
                    ? <Btn variant={u.disabled ? 'sm' : 'danger'} disabled={busyUser === u.id} onClick={() => toggleUser(u)}>
                        {busyUser === u.id ? 'Lagrer…' : u.disabled ? 'Reaktiver' : 'Blokker'}
                      </Btn>
                    : <span className="dim">—</span>}
                </td>
              </tr>
            )) : <tr><td colSpan={7}><Empty title="Ingen brukere" /></td></tr>}
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
  const history = useAsync(() => api.pricingHistory(), []);
  const readiness = useAsync(() => api.betaReadiness(), []);
  const [comm, setComm] = useState('');
  const [pricing, setPricing] = useState<any>({});
  const [features, setFeatures] = useState<any>({});
  const [compliance, setCompliance] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [test, setTest] = useState({ distance_km: '10', duration_min: '20', vehicle_type: 'ai-first' });
  const [routeTest, setRouteTest] = useState({ pickup_address: '', dropoff_address: '', vehicle_type: 'ai-first' });
  const [testResult, setTestResult] = useState<any>(null);
  const [routeResult, setRouteResult] = useState<any>(null);

  useEffect(() => {
    if (data?.default_commission != null) setComm(String(Math.round(data.default_commission * 100)));
    if (data?.pricing) setPricing(data.pricing);
    if (data?.features) setFeatures(data.features);
    if (data?.compliance) setCompliance(data.compliance);
  }, [data]);

  const isSuper = user?.role === 'superadmin';
  const rideClasses = Array.isArray(data?.ride_classes)
    ? data.ride_classes
    : Object.entries(data?.ride_classes || {}).map(([type, value]: [string, any]) => ({ type, ...(value || {}) }));

  const setPrice = (key: string, value: any) => setPricing((p: any) => ({ ...p, [key]: value }));
  const setVehicleRate = (type: string, key: string, value: number) =>
    setPricing((p: any) => ({ ...p, vehicle_rates: { ...(p.vehicle_rates || {}), [type]: { ...(p.vehicle_rates?.[type] || {}), [key]: value } } }));
  const setArea = (id: string, patch: any) =>
    setPricing((p: any) => ({ ...p, areas: { ...(p.areas || {}), [id]: { ...(p.areas?.[id] || {}), ...patch } } }));
  const removeArea = (id: string) => setPricing((p: any) => {
    const areas = { ...(p.areas || {}) }; delete areas[id]; return { ...p, areas };
  });
  const addArea = () => {
    const id = `area_${Object.keys(pricing?.areas || {}).length + 1}`;
    setArea(id, { name: 'Nytt område', enabled: false, center_lat: 59.9139, center_lng: 10.7522, radius_km: 10, pricing: {} });
  };

  const save = async () => {
    const prev = data?.pricing || {};
    const extreme: string[] = [];
    const checkRatio = (label: string, oldValue: any, newValue: any) => {
      const a = Number(oldValue), b = Number(newValue);
      if (a > 0 && Number.isFinite(b) && (b > a * 2 || b < a * 0.5)) extreme.push(`${label}: ${a} → ${b}`);
    };
    ['base_fare','per_km','per_minute','minimum_fare'].forEach((k) => checkRatio(k, prev?.[k], pricing?.[k]));
    for (const type of ['enkelt','trygg','premium']) {
      for (const k of ['base_fare','per_km','per_minute','minimum_fare']) {
        checkRatio(`${type}.${k}`, prev?.vehicle_rates?.[type]?.[k], pricing?.vehicle_rates?.[type]?.[k]);
      }
    }
    if (extreme.length && !window.confirm(`Stor prisendring oppdaget:\n\n${extreme.join('\n')}\n\nVil du publisere likevel?`)) return;
    setBusy(true); setMsg('');
    try {
      await api.patchSettings({ default_commission: Number(comm) / 100, pricing });
      setMsg('Lagret – nye bestillinger bruker ny prisversjon. Eksisterende turer beholder pris og provisjon fra bestillingstidspunktet.');
      await Promise.all([reload(), history.reload(), readiness.reload()]);
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Feil'); }
    finally { setBusy(false); }
  };

  const saveOperations = async () => {
    if (!isSuper) return;
    const nextEnabled = features?.booking_enabled !== false;
    if (!nextEnabled && !window.confirm('Sette nye KJAPP-bestillinger på pause? Pågående turer påvirkes ikke.')) return;
    setBusy(true); setMsg('');
    try {
      await api.patchSettings({ features });
      setMsg(nextEnabled ? 'Nye bestillinger er åpne.' : 'Nye bestillinger er satt på pause. Pågående turer fortsetter.');
      await Promise.all([reload(), readiness.reload()]);
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Feil'); }
    finally { setBusy(false); }
  };

  const saveCompliance = async () => {
    setBusy(true); setMsg('');
    try {
      await api.patchSettings({ compliance });
      setMsg('Beta-gates lagret. Dette registrerer operatørens bekreftelser; det erstatter ikke juridisk eller faglig godkjenning.');
      await Promise.all([reload(), readiness.reload()]);
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Feil'); }
    finally { setBusy(false); }
  };

  const runTest = async () => {
    setTestResult(null); setMsg('');
    try {
      setTestResult(await api.pricingTest({
        distance_km: Number(test.distance_km), duration_min: Number(test.duration_min), vehicle_type: test.vehicle_type,
      }));
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Kunne ikke teste pris'); }
  };

  const runRouteTest = async () => {
    setRouteResult(null); setMsg('');
    try { setRouteResult(await api.pricingRouteTest(routeTest)); }
    catch (e: any) { setMsg(e?.response?.data?.detail || 'Kunne ikke beregne ruten'); }
  };

  const rollback = async (version: number) => {
    if (!isSuper || !window.confirm(`Rull tilbake til prisversjon ${version}? Det opprettes en NY aktiv versjon; eksisterende turer endres ikke.`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await api.pricingRollback(version);
      setMsg(`Rollback gjennomført. Ny aktiv prisversjon: ${r.pricing_version}.`);
      await Promise.all([reload(), history.reload(), readiness.reload()]);
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Rollback feilet'); }
    finally { setBusy(false); }
  };

  if (loading) return <Loader />;
  const fields = [
    ['base_fare','Grunnpris'], ['per_km','Pris per km'], ['per_minute','Pris per minutt'],
    ['waiting_per_minute','Ventetid per minutt'], ['minimum_fare','Minimumspris'],
    ['extra_stop_fee','Ekstra stopp'], ['customer_cancellation_fee','Avbestillingsgebyr kunde'],
    ['late_driver_cancellation_fee','Registrert gebyr ved sen sjåføravbestilling'],
  ];
  const vehicleLabels: any = { 'ai-first': 'KJAPP', enkelt: 'KJAPP Sparsom', trygg: 'KJAPP XL / Komfort', premium: 'KJAPP Premium' };
  const areas = Object.entries(pricing?.areas || {}) as [string, any][];
  const versions = history.data?.items || [];
  const checks = readiness.data?.checks || {};
  const complianceLabels: Record<string,string> = {
    legal_review_completed: 'Juridisk gjennomgang utført',
    transport_requirements_verified: 'Transport-/løyvekrav verifisert',
    commercial_insurance_verified: 'Kommersiell forsikring verifisert',
    privacy_notice_approved: 'Personvernerklæring godkjent',
    terms_approved: 'Kunde-/sjåførvilkår godkjent',
    processor_agreements_verified: 'Databehandleravtaler verifisert',
    tax_vat_reporting_verified: 'Skatt/MVA/rapportering avklart',
    accessibility_review_completed: 'Tilgjengelighetsgjennomgang utført',
    backup_restore_test_completed: 'Backup faktisk gjenopprettet i test',
  };

  return (
    <>
      <PageHead title="Innstillinger" sub={`Sist oppdatert ${fmtDate(data?.updated_at)} · prisversjon ${pricing?.version || 1}`} />
      <ErrorBanner msg={err || history.err || readiness.err} />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 1040 }}>
        <TwoFactorCard />
        <Card>
          <div className="section-title" style={{ marginTop: 0 }}>Provisjon</div>
          <div className="field"><label className="label">Standard KJAPP-serviceavgift (%)</label>
            <input className="input" type="number" min="0" max="50" step="0.1" value={comm} disabled={!isSuper} onChange={(e) => setComm(e.target.value)} /></div>
          <div className="dim" style={{ fontSize: 12 }}>Provisjonen snapshots på hver ny tur. Endringer påvirker ikke historiske eller pågående turer.</div>
        </Card>
      </div>

      <div className="section-title">Teknisk beta-status</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <KV k="Produksjonsmiljø" v={<Pill status={checks.production_env ? 'completed' : 'pending'} label={checks.production_env ? 'Ja' : 'Nei'} />} />
          <KV k="Stripe + webhook" v={<Pill status={checks.stripe_configured ? 'completed' : 'pending'} label={checks.stripe_configured ? 'Klar' : 'Mangler'} />} />
          <KV k="Native push" v={<Pill status={checks.native_push_backend_ready ? 'completed' : 'pending'} label={checks.native_push_backend_ready ? 'Klar' : 'Mangler'} />} />
          <KV k="Admin 2FA" v={<Pill status={checks.admin_2fa_enabled ? 'completed' : 'pending'} label={checks.admin_2fa_enabled ? 'Aktiv' : 'Mangler'} />} />
        </div>
        {!!readiness.data?.blockers?.length && <div className="error-banner" style={{ marginTop: 12 }}>{readiness.data.blockers.join(' · ')}</div>}
        <div className="dim" style={{ marginTop: 10, fontSize: 12 }}>Dette viser teknisk driftsstatus. Løyver, forsikring, avtaler og øvrig norsk regelverk må godkjennes separat.</div>
      </Card>

      <div className="section-title">Operatørkontroll</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
          <div>
            <div className="strong">Nye bestillinger</div>
            <div className="dim" style={{ marginTop: 5, lineHeight: 1.5 }}>
              Nødstopp for nye turer ved alvorlig GPS-, betalings- eller dispatch-hendelse. Pågående turer fortsetter og kan håndteres i Live drift.
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isSuper ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              checked={features?.booking_enabled !== false}
              disabled={!isSuper || busy}
              onChange={(e) => setFeatures((x: any) => ({ ...x, booking_enabled: e.target.checked }))}
            />
            <span className="strong">{features?.booking_enabled !== false ? 'ÅPEN' : 'PAUSET'}</span>
          </label>
        </div>
        {isSuper ? <div style={{ marginTop: 14 }}><Btn onClick={saveOperations} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre driftstatus'}</Btn></div> : null}
      </Card>

      <div className="section-title">Manuelle beta-gates</div>
      <Card>
        <div className="dim" style={{ marginBottom: 14 }}>Kryss kun av når punktet faktisk er kontrollert. Disse feltene er operatørbekreftelser og er bevisst ikke auto-godkjent av systemet.</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          {Object.entries(complianceLabels).map(([key,label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42, cursor: isSuper ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={!!compliance?.[key]} disabled={!isSuper}
                onChange={(e) => setCompliance((x: any) => ({ ...x, [key]: e.target.checked }))} />
              <span className="strong" style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>
        {isSuper ? <div style={{ marginTop: 14 }}><Btn onClick={saveCompliance} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre beta-gates'}</Btn></div> : null}
      </Card>

      <div className="section-title">Dynamisk prissetting</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {fields.map(([key,label]) => <div className="field" key={key}>
            <label className="label">{label} (NOK)</label>
            <input className="input" type="number" min="0" step="0.5" value={pricing?.[key] ?? ''}
              disabled={!isSuper} onChange={(e) => setPrice(key, Number(e.target.value))} />
          </div>)}
          <div className="field"><label className="label">Gratis avbestilling etter aksept (min)</label>
            <input className="input" type="number" min="0" max="60" value={pricing?.free_cancel_minutes ?? 2}
              disabled={!isSuper} onChange={(e) => setPrice('free_cancel_minutes', Number(e.target.value))} /></div>
          <div className="field"><label className="label">Maks søketid etter sjåfør (sek)</label>
            <input className="input" type="number" min="30" max="1800" value={pricing?.dispatch_timeout_seconds ?? 180}
              disabled={!isSuper} onChange={(e) => setPrice('dispatch_timeout_seconds', Number(e.target.value))} /></div>
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
      </Card>

      <div className="section-title">Pris per kjøretøyklasse</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          {['ai-first','enkelt','trygg','premium'].map((type) => {
            const rate = type === 'ai-first'
              ? { base_fare: pricing?.base_fare, per_km: pricing?.per_km, per_minute: pricing?.per_minute, minimum_fare: pricing?.minimum_fare }
              : (pricing?.vehicle_rates?.[type] || {});
            return <div key={type} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 14 }}>
              <div className="strong">{vehicleLabels[type]}</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 10 }}>
                {([['base_fare','Start'],['per_km','Km'],['per_minute','Min'],['minimum_fare','Min.pris']] as any[]).map(([k,l]) =>
                  <div className="field" key={k}><label className="label">{l}</label><input className="input" type="number" min="0" step="0.5"
                    disabled={!isSuper} value={rate?.[k] ?? 0}
                    onChange={(e) => type === 'ai-first' ? setPrice(k, Number(e.target.value)) : setVehicleRate(type,k,Number(e.target.value))}/></div>
                )}
              </div>
            </div>;
          })}
        </div>
      </Card>

      <div className="section-title">Prisområder</div>
      <Card>
        <div className="dim" style={{ marginBottom: 12 }}>Områder bruker henteposisjonen. Første aktive område som inneholder hentestedet overstyrer globale prisregler.</div>
        {areas.map(([id, area]) => <div key={id} style={{ padding: 14, marginBottom: 10, border: '1px solid var(--line)', borderRadius: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: '1.3fr .7fr 1fr 1fr 1fr auto', alignItems: 'end' }}>
            <div className="field"><label className="label">Navn</label><input className="input" disabled={!isSuper} value={area.name || ''} onChange={e=>setArea(id,{name:e.target.value})}/></div>
            <div className="field"><label className="label">Aktiv</label><select className="input" disabled={!isSuper} value={area.enabled === false ? 'off':'on'} onChange={e=>setArea(id,{enabled:e.target.value==='on'})}><option value="on">På</option><option value="off">Av</option></select></div>
            <div className="field"><label className="label">Lat</label><input className="input" type="number" step="0.0001" disabled={!isSuper} value={area.center_lat ?? ''} onChange={e=>setArea(id,{center_lat:Number(e.target.value)})}/></div>
            <div className="field"><label className="label">Lng</label><input className="input" type="number" step="0.0001" disabled={!isSuper} value={area.center_lng ?? ''} onChange={e=>setArea(id,{center_lng:Number(e.target.value)})}/></div>
            <div className="field"><label className="label">Radius km</label><input className="input" type="number" min="0.1" max="300" step="0.5" disabled={!isSuper} value={area.radius_km ?? 10} onChange={e=>setArea(id,{radius_km:Number(e.target.value)})}/></div>
            {isSuper ? <Btn onClick={()=>removeArea(id)}>Fjern</Btn> : null}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 8 }}>
            {([['base_fare','Start'],['per_km','Km'],['per_minute','Min'],['minimum_fare','Min.pris']] as any[]).map(([k,l]) =>
              <div className="field" key={k}><label className="label">{l} – override</label><input className="input" type="number" min="0" step="0.5"
                disabled={!isSuper} value={area.pricing?.[k] ?? ''}
                onChange={e=>setArea(id,{pricing:{...(area.pricing||{}),[k]:e.target.value===''?undefined:Number(e.target.value)}})}/></div>
            )}
          </div>
        </div>)}
        {!areas.length && <div className="dim">Ingen lokale prisområder. Globale regler gjelder i hele tjenesten.</div>}
        {isSuper ? <Btn onClick={addArea}>Legg til prisområde</Btn> : null}
      </Card>

      <div className="section-title">Test pris før publisering</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
          <div className="field"><label className="label">Distanse (km)</label><input className="input" type="number" value={test.distance_km} onChange={e=>setTest({...test,distance_km:e.target.value})}/></div>
          <div className="field"><label className="label">Tid (min)</label><input className="input" type="number" value={test.duration_min} onChange={e=>setTest({...test,duration_min:e.target.value})}/></div>
          <div className="field"><label className="label">Kategori</label><select className="input" value={test.vehicle_type} onChange={e=>setTest({...test,vehicle_type:e.target.value})}>
            <option value="ai-first">KJAPP</option><option value="enkelt">Sparsom</option><option value="trygg">XL / Komfort</option><option value="premium">Premium</option>
          </select></div>
          <Btn onClick={runTest}>Beregn</Btn>
        </div>
        {testResult && <div className="strong" style={{ marginTop: 12 }}>{testResult.price} kr · toppris ×{testResult.surge_multiplier} · versjon {testResult.pricing_version}</div>}

        <div className="section-title">Test ekte norsk rute</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}>
          <div className="field"><label className="label">Fra</label><input className="input" placeholder="Adresse / sted" value={routeTest.pickup_address} onChange={e=>setRouteTest({...routeTest,pickup_address:e.target.value})}/></div>
          <div className="field"><label className="label">Til</label><input className="input" placeholder="Adresse / sted" value={routeTest.dropoff_address} onChange={e=>setRouteTest({...routeTest,dropoff_address:e.target.value})}/></div>
          <div className="field"><label className="label">Kategori</label><select className="input" value={routeTest.vehicle_type} onChange={e=>setRouteTest({...routeTest,vehicle_type:e.target.value})}>
            <option value="ai-first">KJAPP</option><option value="enkelt">Sparsom</option><option value="trygg">XL / Komfort</option><option value="premium">Premium</option>
          </select></div>
          <Btn onClick={runRouteTest}>Test rute</Btn>
        </div>
        {routeResult && <div style={{ marginTop: 12 }}>
          <div className="strong">{routeResult.price} kr · {routeResult.distance_km} km · {routeResult.duration_min} min</div>
          <div className="dim" style={{ fontSize: 12 }}>{routeResult.pickup?.name} → {routeResult.dropoff?.name}{routeResult.pricing_area ? ` · område: ${routeResult.pricing_area}` : ' · global pris'}</div>
        </div>}
      </Card>

      <div style={{ marginTop: 14 }}>
        {isSuper ? <Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Lagrer…' : 'Publiser prisregler'}</Btn>
          : <div className="dim" style={{ fontSize: 12 }}>Kun superadmin kan endre eller publisere priser.</div>}
        {msg && <div style={{ marginTop: 10, color: msg.includes('feil') || msg.includes('Feil') ? 'var(--red)' : 'var(--green)', fontSize: 13 }}>{msg}</div>}
      </div>

      <div className="section-title">Prisversjoner og rollback</div>
      <Card>
        {versions.slice(0, 12).map((v: any, i: number) => <div key={`${v.version}-${i}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 16, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <div className="strong">v{v.version}{v.current ? ' · aktiv' : ''}</div>
          <div className="dim" style={{ fontSize: 12 }}>{fmtDate(v.saved_at)} · provisjon {Math.round((v.default_commission ?? 0.10) * 1000) / 10}%</div>
          {!v.current && isSuper ? <Btn onClick={()=>rollback(v.version)} disabled={busy}>Gjenopprett</Btn> : null}
        </div>)}
        {!versions.length && <div className="dim">Ingen tidligere prisversjoner ennå.</div>}
      </Card>

      <div className="section-title">Kjøretøyklasser</div>
      <Card><div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {rideClasses.map((r: any, i: number) => <div key={r.type || i}><div className="strong">{r.label || r.name || r.type}</div>
          <div className="dim" style={{ fontSize: 12 }}>×{r.multiplier ?? r.price_multiplier ?? 1}</div></div>)}
      </div></Card>
    </>
  );
}
