import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api, apiError, FleetDocument, FleetDriver, FleetDriverDetail, FleetLive,
  FleetLiveDriver, FleetMe, FleetOverview, FleetPayout, FleetVehicle,
} from './api';
import { useAuth } from './auth';
import { FleetWorkbook, FleetWorkbookTrip, loadFleetWorkbook } from './xlsx';
import { Brand } from './App';
import { FleetMap } from './FleetMap';

const fmtMoney = (v: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(v) || 0))} kr`;
const fmtDate = (v?: string) => v ? new Date(v).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const monthTitle = (date = new Date()) => date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
const nameOf = (d: FleetDriver) => d.fullName || d.full_name || d.email || 'Sjåfør';
const statusDone = (s: string) => ['arrived', 'completed', 'rated', 'Fullført'].includes(s);

const liveStatusLabel = (s?: string) => ({
  available: 'Ledig',
  driver_on_way: 'På vei til kunde',
  at_pickup: 'Ved hentested',
  in_trip: 'På tur',
  gps_stale: 'GPS utløpt',
  offline: 'Avlogget',
}[s || ''] || s || 'Ukjent');

const complianceLabel = (s?: string) => ({
  VALID: 'Godkjent',
  EXPIRING: 'Utløper snart',
  EXPIRED: 'Utløpt',
  PENDING: 'Til vurdering',
  REJECTED: 'Avvist',
}[s || ''] || s || 'Ukjent');

const complianceClass = (s?: string) =>
  s === 'VALID' ? 'status-green' : s === 'EXPIRING' || s === 'PENDING' ? 'status-amber' : 'status-red';

const identityLabel = (s?: string) => ({
  verified: 'Verifisert',
  pending_review: 'Til kontroll',
  retry_required: 'Ny selfie',
  not_submitted: 'Mangler',
}[s || ''] || 'Mangler');

const identityClass = (s?: string) =>
  s === 'verified' ? 'status-green' : s === 'pending_review' ? 'status-amber' : 'status-red';

function Loading() { return <div className="page-loading"><div className="spinner" /></div>; }
function ErrorBox({ message }: { message: string }) { return message ? <div className="error-box">{message}</div> : null; }

function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{action}</div>;
}

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(email.trim(), password); nav('/'); }
    catch (e: any) { setErr(e?.message || apiError(e)); }
    finally { setBusy(false); }
  };

  return <div className="login-screen">
    <div className="login-copy">
      <Brand />
      <div className="login-copy-main">
        <h1>Kontroll uten støy.</h1>
        <p>Administrer sjåfører, turer og oppgjør fra ett sted.</p>
      </div>
      <div className="login-domain">fleet.kjappapp.no</div>
    </div>
    <form className="login-card" onSubmit={submit}>
      <h2>Logg inn</h2>
      <p>For løyvehavere og godkjente partnere</p>
      <label className="sr-only" htmlFor="fleet-email">E-post</label>
      <input id="fleet-email" type="email" autoComplete="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label className="sr-only" htmlFor="fleet-password">Passord</label>
      <input id="fleet-password" type="password" autoComplete="current-password" placeholder="Passord" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <ErrorBox message={err} />
      <button className="primary-button" disabled={busy}>{busy ? 'Logger inn…' : 'Logg inn'}</button>
      <Link to="/glemt-passord" className="text-link">Glemt passord?</Link>
      <div className="approval-note">Tilgang aktiveres først etter at KJAPP har godkjent løyvehaversøknaden og dokumentasjonen.</div>
    </form>
  </div>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.forgotPassword(email.trim()); } catch { /* deliberately identical result */ }
    setSent(true); setBusy(false);
  };
  return <div className="auth-simple"><Brand /><div className="auth-simple-card">
    <h1>Glemt passord</h1>
    {sent ? <><p>Hvis e-posten finnes hos KJAPP, har vi sendt en lenke for å velge nytt passord.</p><Link className="primary-button link-button" to="/login">Tilbake til innlogging</Link></> :
      <form onSubmit={submit}><p>Skriv inn e-posten som er knyttet til den godkjente løyvehaverkontoen.</p><input type="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required /><button className="primary-button" disabled={busy}>{busy ? 'Sender…' : 'Send lenke'}</button><Link className="text-link" to="/login">Tilbake</Link></form>}
  </div></div>;
}

export function ResetPasswordPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'checking'|'invalid'|'form'|'done'>('checking');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.checkResetToken(token).then(() => setState('form')).catch(() => setState('invalid')); }, [token]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (pw.length < 6) return setErr('Passord må ha minst 6 tegn');
    if (pw !== pw2) return setErr('Passordene er ikke like');
    setBusy(true);
    try { await api.resetPassword(token, pw); setState('done'); }
    catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  };
  return <div className="auth-simple"><Brand /><div className="auth-simple-card">
    {state === 'checking' ? <Loading /> : null}
    {state === 'invalid' ? <><h1>Lenken virker ikke</h1><p>Lenken er ugyldig eller utløpt.</p><Link className="primary-button link-button" to="/glemt-passord">Be om ny lenke</Link></> : null}
    {state === 'form' ? <form onSubmit={submit}><h1>Velg nytt passord</h1><p>Bruk det nye passordet neste gang du logger inn i KJAPP Partner.</p><input type="password" placeholder="Nytt passord" value={pw} onChange={(e) => setPw(e.target.value)} required /><input type="password" placeholder="Gjenta nytt passord" value={pw2} onChange={(e) => setPw2(e.target.value)} required /><ErrorBox message={err} /><button className="primary-button" disabled={busy}>{busy ? 'Lagrer…' : 'Lagre nytt passord'}</button></form> : null}
    {state === 'done' ? <><h1>Passordet er endret</h1><p>Du kan nå logge inn i partnerportalen.</p><Link className="primary-button link-button" to="/login">Logg inn</Link></> : null}
  </div></div>;
}

function LiveFleet({ drivers }: { drivers: FleetLiveDriver[] }) {
  const online = drivers.filter((d) => d.online);
  const fresh = online.filter((d) => d.gps_fresh);
  const stale = online.filter((d) => !d.gps_fresh);
  return <div className="live-fleet-card">
    <div className="live-fleet-head">
      <div><div className="eyebrow green">LIVE FLÅTE</div><small>Oppdateres automatisk hvert 5. sekund</small></div>
      <span className="live-dot-label"><i /> LIVE</span>
    </div>
    <div className="map-shell">
      <FleetMap drivers={drivers} />
      {!fresh.length ? <div className="map-empty-overlay">Ingen biler med fersk GPS akkurat nå</div> : null}
    </div>
    <div className="live-fleet-foot">
      <span>{fresh.length} med fersk GPS</span>
      <span>{online.length} pålogget{stale.length ? ` · ${stale.length} GPS utløpt` : ''}</span>
    </div>
  </div>;
}

function LiveTrips({ live }: { live: FleetLive | null }) {
  const drivers = live?.drivers || [];
  const trips = live?.trips || [];
  const driverName = (id?: string) => drivers.find((d) => d.id === id)?.name || 'Sjåfør';
  return <div className="recent-card">
    <div className="eyebrow">LIVE TURER</div>
    {trips.length ? trips.slice(0, 5).map((t) =>
      <div className="recent-row live-trip-row" key={t.trip_id}>
        <div>
          <strong>{t.pickup_address || 'Hentested'} → {t.dropoff_address || 'Destinasjon'}</strong>
          <span>{driverName(t.driver_id)} · {liveStatusLabel(t.status)}</span>
        </div>
        <b className="status-green">{String(t.trip_id || '').slice(0, 6)}</b>
      </div>
    ) : <div className="empty-state">Ingen aktive turer akkurat nå.</div>}
  </div>;
}

export function OverviewPage() {
  const [me, setMe] = useState<FleetMe | null>(null);
  const [ov, setOv] = useState<FleetOverview | null>(null);
  const [live, setLive] = useState<FleetLive | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([api.fleetMe(), api.overview(), api.live()])
      .then(([m, o, l]) => {
        if (!mounted) return;
        setMe(m); setOv(o); setLive(l);
      })
      .catch((e) => mounted && setErr(apiError(e)));

    const liveTimer = window.setInterval(() => {
      api.live().then((l) => mounted && setLive(l)).catch(() => {});
    }, 5000);
    const overviewTimer = window.setInterval(() => {
      api.overview().then((o) => mounted && setOv(o)).catch(() => {});
    }, 30000);
    return () => {
      mounted = false;
      window.clearInterval(liveTimer);
      window.clearInterval(overviewTimer);
    };
  }, []);

  if (!me || !ov) return err ? <ErrorBox message={err} /> : <Loading />;
  const liveDrivers = live?.drivers || [];
  const online = liveDrivers.filter((d) => d.online).length;
  const available = liveDrivers.filter((d) => d.operational_status === 'available').length;
  const active = liveDrivers.filter((d) => ['driver_on_way', 'at_pickup', 'in_trip'].includes(d.operational_status || '')).length;

  return <div className="page-content">
    <PageHead title={`God kveld, ${me.name}`} sub="Live oversikt over egen virksomhet" />
    <div className="kpi-grid four">
      <div className="kpi-card"><span>TURER I DAG</span><strong>{ov.today.trips}</strong><small>{fmtMoney(ov.today.gross)} brutto</small></div>
      <div className="kpi-card"><span>SJÅFØRER ONLINE</span><strong>{online} / {ov.drivers_total}</strong><small>{available} ledige nå</small></div>
      <div className="kpi-card desktop-kpi-extra"><span>AKTIVE TURER</span><strong>{active}</strong><small>på vei / hentested / i tur</small></div>
      <div className="kpi-card desktop-kpi-extra"><span>UKE NETTO</span><strong>{fmtMoney(ov.week.net)}</strong><small>etter {ov.commission_pct}% provisjon</small></div>
    </div>
    <div className="overview-grid"><LiveFleet drivers={liveDrivers} /><LiveTrips live={live} /></div>
    <div className="mobile-week"><span>Denne uken</span><strong>{fmtMoney(ov.week.net)}</strong><small>{ov.week.trips} turer · netto etter provisjon</small></div>
    <div className="week-summary"><span>Denne uken</span><strong>{ov.week.trips} turer</strong><span>{fmtMoney(ov.week.gross)} brutto</span><span>{fmtMoney(ov.week.gross - ov.week.net)} KJAPP</span><b>{fmtMoney(ov.week.net)} netto</b></div>
    <ErrorBox message={err} />
  </div>;
}


export function LiveOpsPage() {
  const [live, setLive] = useState<FleetLive | null>(null);
  const [err, setErr] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all'|'online'|'available'|'active'|'stale'>('all');

  useEffect(() => {
    let mounted = true;
    const load = () => api.live()
      .then((data) => {
        if (!mounted) return;
        setLive(data);
        setUpdatedAt(new Date());
        setErr('');
      })
      .catch((e) => mounted && setErr(apiError(e)));
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  if (!live && !err) return <Loading />;

  const drivers = live?.drivers || [];
  const trips = live?.trips || [];
  const online = drivers.filter((d) => d.online);
  const available = drivers.filter((d) => d.operational_status === 'available');
  const active = drivers.filter((d) => ['driver_on_way','at_pickup','in_trip'].includes(d.operational_status || ''));
  const stale = drivers.filter((d) => d.operational_status === 'gps_stale');
  const visibleDrivers = drivers.filter((d) => {
    if (filter === 'online') return d.online;
    if (filter === 'available') return d.operational_status === 'available';
    if (filter === 'active') return ['driver_on_way','at_pickup','in_trip'].includes(d.operational_status || '');
    if (filter === 'stale') return d.operational_status === 'gps_stale';
    return true;
  });
  const driverName = (id?: string) => drivers.find((d) => d.id === id)?.name || 'Sjåfør';

  return <div className="page-content live-ops-page">
    <PageHead title="Live drift" sub="Sanntidsoversikt over biler, sjåfører og aktive turer i din egen flåte" />

    <div className="kpi-grid five live-ops-kpis">
      <button className={filter === 'all' ? 'kpi-card active-filter' : 'kpi-card'} onClick={() => setFilter('all')}>
        <span>ALLE SJÅFØRER</span><strong>{drivers.length}</strong><small>{updatedAt ? 'Oppdatert ' + updatedAt.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'}</small>
      </button>
      <button className={filter === 'online' ? 'kpi-card active-filter' : 'kpi-card'} onClick={() => setFilter('online')}>
        <span>ONLINE</span><strong>{online.length}</strong><small>pålogget nå</small>
      </button>
      <button className={filter === 'available' ? 'kpi-card active-filter' : 'kpi-card'} onClick={() => setFilter('available')}>
        <span>LEDIGE</span><strong>{available.length}</strong><small>klar for ny tur</small>
      </button>
      <button className={filter === 'active' ? 'kpi-card active-filter' : 'kpi-card'} onClick={() => setFilter('active')}>
        <span>AKTIVE TURER</span><strong>{active.length}</strong><small>henting / på tur</small>
      </button>
      <button className={filter === 'stale' ? 'kpi-card active-filter' : 'kpi-card'} onClick={() => setFilter('stale')}>
        <span>GPS UTLØPT</span><strong>{stale.length}</strong><small>krever oppfølging</small>
      </button>
    </div>

    <div className="live-ops-grid">
      <section className="live-ops-map-card">
        <div className="live-fleet-head">
          <div><div className="eyebrow green">SANNTIDSKART</div><small>Oppdateres hvert 5. sekund</small></div>
          <span className="live-dot-label"><i /> LIVE</span>
        </div>
        <div className="live-ops-map-shell">
          <FleetMap drivers={visibleDrivers} />
          {!visibleDrivers.some((d) => d.online && d.gps_fresh) ? <div className="map-empty-overlay">Ingen biler med fersk GPS i valgt filter</div> : null}
        </div>
      </section>

      <section className="live-ops-driver-card">
        <div className="live-ops-section-head">
          <div><div className="eyebrow">SJÅFØRER</div><small>{visibleDrivers.length} i valgt filter</small></div>
        </div>
        <div className="live-driver-list">
          {visibleDrivers.map((d) => <div className="live-driver-row" key={d.id}>
            <div className="live-driver-main">
              <i className={'status-dot ' + (d.online ? 'on' : '')} />
              <div><strong>{d.name || d.email || 'Sjåfør'}</strong><span>{d.car || '—'}{d.plate ? ' · ' + d.plate : ''}</span></div>
            </div>
            <div className="live-driver-meta">
              <b className={d.operational_status === 'available' ? 'status-green' : d.operational_status === 'gps_stale' ? 'status-amber' : d.online ? 'status-green' : 'muted'}>{liveStatusLabel(d.operational_status)}</b>
              <span>{d.last_location_at ? new Date(d.last_location_at).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : 'Ingen GPS'}</span>
            </div>
          </div>)}
          {!visibleDrivers.length ? <div className="empty-state padded">Ingen sjåfører i dette filteret.</div> : null}
        </div>
      </section>
    </div>

    <section className="table-card no-tools live-ops-trips-card">
      <div className="live-ops-section-head padded-head">
        <div><div className="eyebrow">AKTIVE TURER</div><small>{trips.length} pågående nå</small></div>
      </div>
      <div className="fleet-table live-trip-table">
        <div className="tr th"><span>TUR</span><span>SJÅFØR</span><span>FRA → TIL</span><span>STATUS</span><span>PRIS</span></div>
        {trips.map((t) => <div className="tr" key={t.trip_id}>
          <span className="mono">{String(t.trip_id || '').slice(0, 8)}</span>
          <span>{driverName(t.driver_id)}</span>
          <span>{t.pickup_address || 'Hentested'} → {t.dropoff_address || 'Destinasjon'}</span>
          <span className="status-green">{liveStatusLabel(t.status)}</span>
          <span className="mono">{fmtMoney(t.price || 0)}</span>
        </div>)}
        {!trips.length ? <div className="empty-state padded">Ingen aktive turer akkurat nå.</div> : null}
      </div>
    </section>

    <ErrorBox message={err} />
  </div>;
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [car, setCar] = useState(''); const [plate, setPlate] = useState(''); const [email, setEmail] = useState(''); const [vehicle, setVehicle] = useState('ai-first'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { await api.createInvite({ car, plate: plate.toUpperCase(), email: email || undefined, vehicle_type: vehicle, note }); onDone(); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">NY SJÅFØR</span><h2>Opprett invitasjon</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p>Sjåføren registrerer seg via KJAPP sin eksisterende invitasjonsflyt.</p><input placeholder="Bilmodell" value={car} onChange={(e) => setCar(e.target.value)} required /><input placeholder="Skiltnummer" value={plate} onChange={(e) => setPlate(e.target.value)} required /><select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="ai-first">Standard</option><option value="enkelt">Sparsom</option><option value="trygg">Komfort</option><option value="premium">Premium</option></select><input type="email" placeholder="E-post (valgfritt)" value={email} onChange={(e) => setEmail(e.target.value)} /><textarea placeholder="Kort notat (valgfritt)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} /><ErrorBox message={err} /><button className="primary-button" disabled={busy}>{busy ? 'Oppretter…' : 'Opprett invitasjon'}</button></form></div>;
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<FleetDriverDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => Promise.all([api.drivers(), api.invites()])
    .then(([d, i]) => { setDrivers(d.drivers || []); setInvites(i.invites || []); })
    .catch((e) => setErr(apiError(e)));
  useEffect(() => { load(); }, []);

  const openDriver = async (id: string) => {
    setDetailBusy(true);
    try { setSelected(await api.driverDetail(id)); }
    catch (e) { setErr(apiError(e)); }
    finally { setDetailBusy(false); }
  };

  const filtered = drivers.filter((d) =>
    `${nameOf(d)} ${d.car || ''} ${d.plate || ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return <div className="page-content">
    <PageHead title="Sjåfører" sub="Administrer personer og biler i din flåte" action={<button className="primary-button compact-button" onClick={() => setModal(true)}>+ Legg til sjåfør</button>} />
    <div className="table-card">
      <div className="table-tools"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk navn, skilt eller bil" /></div>
      <div className="fleet-table driver-table">
        <div className="tr th"><span>SJÅFØR</span><span>BIL</span><span>STATUS</span><span>SELFIE ID</span><span>TURER I DAG</span><span>OMSETNING</span></div>
        {filtered.map((d) =>
          <button className="tr row-button" key={d.id} onClick={() => void openDriver(d.id)}>
            <span className="driver-name"><i className={`status-dot ${d.online ? 'on' : ''}`} />{nameOf(d)}</span>
            <span>{d.car || '—'}{d.plate ? ` · ${d.plate}` : ''}</span>
            <span className={d.online ? 'status-green' : 'muted'}>{d.online ? 'Pålogget' : 'Avlogget'}</span>
            <span className={identityClass(d.identity_verification_status)}>{identityLabel(d.identity_verification_status)}</span>
            <span className="mono">{d.today_trips || 0}</span>
            <span className="mono">{fmtMoney(d.today_income || 0)}</span>
          </button>
        )}
        {!filtered.length ? <div className="empty-state padded">Ingen sjåfører funnet.</div> : null}
      </div>
    </div>
    <section className="invites-section">
      <h2>Invitasjoner</h2><p>Opprett en invitasjon og send den til ny sjåfør.</p>
      {invites.length ? <div className="invite-chips">{invites.slice(0, 8).map((i) => <span key={i.token}>{i.email || i.plate || 'Invitasjon'} · {i.used ? 'Godtatt' : i.email_sent ? 'Sendt' : 'Venter'}</span>)}</div> : null}
    </section>
    <ErrorBox message={err} />
    {modal ? <InviteModal onClose={() => setModal(false)} onDone={() => { setModal(false); load(); }} /> : null}
    {detailBusy ? <div className="modal-backdrop"><div className="modal-card"><Loading /></div></div> : null}
    {selected ? <DriverDetailModal driver={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function DriverDetailModal({ driver, onClose }: { driver: FleetDriverDetail; onClose: () => void }) {
  const docs = driver.documents || [];
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card detail-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">SJÅFØR</span><h2>{nameOf(driver)}</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>
      <div className="detail-grid">
        <InfoRow label="Status" value={<span className={driver.online ? 'status-green' : 'muted'}>{driver.online ? 'Pålogget' : 'Avlogget'}</span>} />
        <InfoRow label="Godkjenning" value={driver.approved ? 'Godkjent' : 'Venter'} />
        <InfoRow label="Selfie ID" value={<span className={identityClass(driver.identity_verification_status)}>{identityLabel(driver.identity_verification_status)}</span>} />
        <InfoRow label="Bil" value={driver.car || '—'} />
        <InfoRow label="Skilt" value={driver.plate || '—'} />
        <InfoRow label="Telefon" value={driver.phone || '—'} />
        <InfoRow label="E-post" value={driver.email || '—'} />
        <InfoRow label="Fullførte turer" value={driver.trips_completed ?? 0} />
        <InfoRow label="Sist GPS" value={driver.last_location_at ? new Date(driver.last_location_at).toLocaleString('nb-NO') : '—'} />
      </div>
      {driver.active_trip ? <div className="detail-section"><span className="eyebrow green">AKTIV TUR</span><strong>{driver.active_trip.pickup_address || 'Hentested'} → {driver.active_trip.dropoff_address || 'Destinasjon'}</strong><small>{liveStatusLabel(driver.active_trip.status)}</small></div> : null}
      <div className="detail-section"><span className="eyebrow">DOKUMENTER</span>{docs.length ? docs.map((d) => <div className="detail-doc" key={d.id}><span>{d.doc_type || d.filename || 'Dokument'}</span><b className={complianceClass(d.compliance)}>{complianceLabel(d.compliance)}</b></div>) : <small>Ingen dokumenter registrert.</small>}</div>
    </div>
  </div>;
}

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api.vehicles().then((r) => setVehicles(r.vehicles || [])).catch((e) => setErr(apiError(e))); }, []);
  const rows = vehicles.filter((v) => `${v.car || ''} ${v.plate || ''} ${v.driver_name || ''}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="page-content">
    <PageHead title="Kjøretøy" sub="Biler registrert på sjåførene i din flåte" />
    <div className="kpi-grid three">
      <div className="kpi-card"><span>REGISTRERTE BILER</span><strong>{vehicles.length}</strong><small>i din flåte</small></div>
      <div className="kpi-card"><span>PÅLOGGET</span><strong>{vehicles.filter((v) => v.online).length}</strong><small>sjåfører online</small></div>
      <div className="kpi-card"><span>FERSK GPS</span><strong>{vehicles.filter((v) => v.gps_fresh).length}</strong><small>aktive posisjoner</small></div>
    </div>
    <div className="table-card">
      <div className="table-tools"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk bil, skilt eller sjåfør" /></div>
      <div className="fleet-table vehicle-table">
        <div className="tr th"><span>BIL</span><span>SKILT</span><span>SJÅFØR</span><span>STATUS</span><span>SIST GPS</span></div>
        {rows.map((v) => <div className="tr" key={v.id}><span>{v.car || '—'}</span><span className="mono">{v.plate || '—'}</span><span>{v.driver_name || '—'}</span><span className={v.online && v.gps_fresh ? 'status-green' : v.online ? 'status-amber' : 'muted'}>{v.online ? (v.gps_fresh ? 'Online' : 'GPS utløpt') : 'Offline'}</span><span className="muted">{v.last_location_at ? new Date(v.last_location_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>)}
        {!rows.length ? <div className="empty-state padded">Ingen kjøretøy funnet.</div> : null}
      </div>
    </div>
    <ErrorBox message={err} />
  </div>;
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<FleetDocument[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    api.documents().then((r) => { setDocs(r.documents || []); setSummary(r.summary || {}); }).catch((e) => setErr(apiError(e)));
  }, []);

  const openDoc = async (d: FleetDocument) => {
    if (!d.storage_path) return;
    setBusyId(d.id);
    setErr('');
    try {
      const blob = await api.downloadFile(d.storage_path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setErr(apiError(e)); }
    finally { setBusyId(''); }
  };

  return <div className="page-content">
    <PageHead title="Dokumenter" sub="Løyvehaver- og sjåførdokumenter som tilhører din flåte" />
    <div className="kpi-grid four compliance-kpis">
      <div className="kpi-card"><span>GODKJENT</span><strong>{summary.VALID || 0}</strong><small>gyldige dokumenter</small></div>
      <div className="kpi-card"><span>UTLØPER</span><strong>{summary.EXPIRING || 0}</strong><small>innen 30 dager</small></div>
      <div className="kpi-card"><span>TIL VURDERING</span><strong>{summary.PENDING || 0}</strong><small>venter på KJAPP</small></div>
      <div className="kpi-card"><span>AVVIK</span><strong>{(summary.EXPIRED || 0) + (summary.REJECTED || 0)}</strong><small>utløpt eller avvist</small></div>
    </div>
    <div className="table-card no-tools">
      <div className="fleet-table document-table">
        <div className="tr th"><span>DOKUMENT</span><span>EIER</span><span>TYPE</span><span>STATUS</span><span>UTLØP</span><span /></div>
        {docs.map((d) => <div className="tr" key={d.id}><span>{d.filename || d.doc_type || 'Dokument'}</span><span>{d.owner_name || (d.owner_type === 'fleet' ? 'Bedrift' : 'Sjåfør')}</span><span className="muted">{d.owner_type === 'fleet' ? 'Løyvehaver' : d.doc_type || 'Sjåfør'}</span><span className={complianceClass(d.compliance)}>{complianceLabel(d.compliance)}</span><span className="muted">{d.expiry ? fmtDate(d.expiry) : '—'}</span><span><button className="table-action" disabled={!d.storage_path || busyId === d.id} onClick={() => void openDoc(d)}>{busyId === d.id ? 'Åpner…' : 'Åpne'}</button></span></div>)}
        {!docs.length ? <div className="empty-state padded">Ingen dokumenter funnet for denne flåten.</div> : null}
      </div>
    </div>
    <ErrorBox message={err} />
  </div>;
}

type Range = 'today' | 'week' | 'month';
function localDateKey(d = new Date()) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
function weekStart() { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); d.setHours(0,0,0,0); return d; }

export function TripsPage() {
  const [trips, setTrips] = useState<FleetWorkbookTrip[]>([]); const [range, setRange] = useState<Range>('today'); const [q, setQ] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const now = new Date(); const current = loadFleetWorkbook(now.getFullYear(), now.getMonth() + 1); const ws = weekStart();
    const needsPrev = ws.getMonth() !== now.getMonth();
    const previous = needsPrev ? loadFleetWorkbook(ws.getFullYear(), ws.getMonth() + 1) : Promise.resolve(null);
    Promise.all([current, previous]).then(([c, p]) => setTrips([...(p?.trips || []), ...c.trips])).catch((e) => setErr(apiError(e))).finally(() => setLoading(false));
  }, []);
  const rows = useMemo(() => {
    const today = localDateKey(); const ws = localDateKey(weekStart()); const month = today.slice(0, 7);
    return [...trips].filter((t) => range === 'today' ? t.date === today : range === 'week' ? t.date >= ws : t.date.startsWith(month)).filter((t) => `${t.tripId} ${t.driver} ${t.from} ${t.to}`.toLowerCase().includes(q.toLowerCase())).reverse();
  }, [trips, range, q]);
  return <div className="page-content"><PageHead title="Turer" sub="Fullførte turer utført av sjåførene i din flåte" />
    <div className="trip-filter"><input placeholder="Søk etter tur, adresse eller sjåfør" value={q} onChange={(e) => setQ(e.target.value)} /><div>{(['today','week','month'] as Range[]).map((r) => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r === 'today' ? 'I dag' : r === 'week' ? 'Denne uken' : 'Denne måneden'}</button>)}</div></div>
    <div className="table-card no-tools"><div className="fleet-table trip-table"><div className="tr th"><span>DATO</span><span>SJÅFØR</span><span>FRA → TIL</span><span>STATUS</span><span>PRIS</span></div>{loading ? <Loading /> : rows.map((t, i) => <div className="tr" key={`${t.tripId}-${i}`}><span className="mono muted">{t.date.slice(5)}</span><span>{t.driver}</span><span>{t.from || '—'} → {t.to || '—'}</span><span className={statusDone(t.status) ? 'status-green' : 'muted'}>{statusDone(t.status) ? 'Fullført' : t.status}</span><span className="mono">{fmtMoney(t.price)}</span></div>)}{!loading && !rows.length ? <div className="empty-state padded">Ingen fullførte turer i valgt periode.</div> : null}</div></div><ErrorBox message={err} />
  </div>;
}

function payoutAmount(p: FleetPayout) { return p.net ?? p.amount ?? ((p.gross || 0) - (p.commission_amount ?? p.commission ?? 0)); }
function payoutLabel(p: FleetPayout) { if (p.period_start || p.period_end) return `${p.period_start ? fmtDate(p.period_start).slice(0,5) : '—'}–${p.period_end ? fmtDate(p.period_end).slice(0,5) : '—'}`; return 'Oppgjør'; }

export function FinancePage() {
  const [book, setBook] = useState<FleetWorkbook | null>(null); const [payouts, setPayouts] = useState<FleetPayout[]>([]); const [me, setMe] = useState<FleetMe | null>(null); const [err, setErr] = useState(''); const [downloading, setDownloading] = useState(false);
  const now = new Date();
  useEffect(() => { Promise.all([loadFleetWorkbook(now.getFullYear(), now.getMonth() + 1), api.payouts(), api.fleetMe()]).then(([b,p,m]) => { setBook(b); setPayouts(p.payouts || []); setMe(m); }).catch((e) => setErr(apiError(e))); }, []);
  if (!book || !me) return err ? <ErrorBox message={err} /> : <Loading />;
  const rate = Math.round((me.commission_rate ?? (book.summary.gross ? book.summary.commission / book.summary.gross : .10)) * 100);
  const download = async () => { setDownloading(true); try { const buf = await api.exportMonthly(now.getFullYear(), now.getMonth() + 1); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `KJAPP-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.xlsx`; a.click(); URL.revokeObjectURL(url); } catch (e) { setErr(apiError(e)); } finally { setDownloading(false); } };
  return <div className="page-content"><PageHead title="Økonomi" sub="Enkelt oppgjør. Ingen regnskapssystem inni KJAPP." />
    <div className="kpi-grid three"><div className="kpi-card"><span>BRUTTO DENNE MÅNEDEN</span><strong>{fmtMoney(book.summary.gross)}</strong><small>{book.summary.trips} turer</small></div><div className="kpi-card"><span>KJAPP PROVISJON</span><strong>{fmtMoney(book.summary.commission)}</strong><small>{rate}% avtalt</small></div><div className="kpi-card"><span>NETTO</span><strong>{fmtMoney(book.summary.net)}</strong><small>før øvrige kostnader</small></div></div>
    <div className="finance-grid"><div className="payout-card"><div className="eyebrow">UTBETALINGER</div>{payouts.slice(0,5).map((p,i) => <div className="payout-row" key={p.id || i}><span>{payoutLabel(p)}</span><b className="mono">{fmtMoney(payoutAmount(p))}</b><em className={['paid','completed','utbetalt'].includes(String(p.status).toLowerCase()) ? 'status-green' : 'muted'}>{p.status === 'paid' ? 'Utbetalt' : p.status || 'Registrert'}</em></div>)}{!payouts.length ? <div className="empty-state">Ingen registrerte utbetalinger ennå.</div> : null}</div><div className="report-card"><div className="eyebrow">MÅNEDSRAPPORT</div><h2>{monthTitle(now)}</h2><p>Turer · sjåførfordeling<br/>brutto · provisjon · netto</p><button className="primary-button" onClick={download} disabled={downloading}>{downloading ? 'Laster…' : 'Last ned Excel'}</button><small>Eksporten genereres av KJAPP-backenden fra ekte turdata.</small></div></div><ErrorBox message={err} />
  </div>;
}

function maskBank(v?: string) { if (!v) return '—'; const clean = v.replace(/\s/g,''); return clean.length > 5 ? `•••• •• ${clean.slice(-5)}` : '•••••'; }
export function BedriftPage() {
  const { user } = useAuth(); const [me, setMe] = useState<FleetMe | null>(null); const [err, setErr] = useState('');
  useEffect(() => { api.fleetMe().then(setMe).catch((e) => setErr(apiError(e))); }, []);
  if (!me) return err ? <ErrorBox message={err} /> : <Loading />;
  const rate = Math.round((me.commission_rate ?? .10) * 100); const active = me.status ? me.status !== 'suspended' : me.active !== false;
  return <div className="page-content"><PageHead title="Bedrift" sub="Virksomhetsinformasjon og KJAPP-avtale" /><div className="company-grid"><div className="company-card"><div className="eyebrow">VIRKSOMHET</div><InfoRow label="Firmanavn" value={me.name}/><InfoRow label="Organisasjonsnummer" value={me.org_number || '—'}/><InfoRow label="Kontaktperson" value={me.contact_name || user?.fullName || '—'}/><InfoRow label="E-post" value={me.contact_email || user?.email || '—'}/><InfoRow label="Telefon" value={me.contact_phone || '—'}/><InfoRow label="Bankkonto" value={maskBank(me.bank_account)}/></div><div className="company-side"><div className="agreement-card"><div className="eyebrow">KJAPP-AVTALE</div><span className="field-label">Provisjon</span><strong className="agreement-rate">{rate}%</strong><span className="field-label">Aktiv siden</span><b className="mono agreement-date">{fmtDate(me.created_at)}</b><span className="field-label">Status</span><b className={active ? 'status-green' : 'status-red'}>{active ? 'Aktiv' : 'Suspendert'}</b></div><div className="support-card"><div className="eyebrow">SUPPORT</div><p>Trenger du hjelp med konto, sjåfør eller oppgjør?</p><a href="https://kjappapp.no/hjelp">Kontakt KJAPP →</a></div></div></div><ErrorBox message={err} />
  </div>;
}
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) { return <div className="info-row"><span>{label}</span><b>{value}</b></div>; }
