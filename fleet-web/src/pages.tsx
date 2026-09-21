import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiError, FleetDriver, FleetMe, FleetOverview, FleetPayout } from './api';
import { useAuth } from './auth';
import { FleetWorkbook, FleetWorkbookTrip, loadFleetWorkbook } from './xlsx';
import { Brand } from './App';

const fmtMoney = (v: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(v) || 0))} kr`;
const fmtDate = (v?: string) => v ? new Date(v).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const monthTitle = (date = new Date()) => date.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
const nameOf = (d: FleetDriver) => d.fullName || d.full_name || d.email || 'Sjåfør';
const statusDone = (s: string) => ['arrived', 'completed', 'rated', 'Fullført'].includes(s);

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

function LiveFleet({ drivers }: { drivers: FleetDriver[] }) {
  const points = drivers.filter((d) => d.online && Number.isFinite(d.last_lat) && Number.isFinite(d.last_lng));
  const coords = points.map((d) => ({ lat: Number(d.last_lat), lng: Number(d.last_lng) }));
  const minLat = Math.min(...coords.map((c) => c.lat)); const maxLat = Math.max(...coords.map((c) => c.lat));
  const minLng = Math.min(...coords.map((c) => c.lng)); const maxLng = Math.max(...coords.map((c) => c.lng));
  const pos = (d: FleetDriver) => {
    const lat = Number(d.last_lat); const lng = Number(d.last_lng);
    const x = maxLng === minLng ? 50 : 12 + ((lng - minLng) / (maxLng - minLng)) * 76;
    const y = maxLat === minLat ? 52 : 84 - ((lat - minLat) / (maxLat - minLat)) * 66;
    return { left: `${x}%`, top: `${y}%` };
  };
  return <div className="live-fleet-card">
    <div className="eyebrow green">LIVE FLÅTE</div>
    <div className="map-grid" aria-label={`${points.length} sjåfører med aktiv posisjon`}>
      {points.map((d) => <span key={d.id} className="fleet-dot" style={pos(d)} title={nameOf(d)} />)}
      {!points.length ? <div className="map-empty">Ingen aktive posisjoner akkurat nå</div> : null}
    </div>
    <div className="live-fleet-foot"><span>{points.length} på kartet</span><span>{drivers.filter((d) => d.online).length} pålogget</span></div>
  </div>;
}

export function OverviewPage() {
  const [me, setMe] = useState<FleetMe | null>(null); const [ov, setOv] = useState<FleetOverview | null>(null); const [drivers, setDrivers] = useState<FleetDriver[]>([]); const [book, setBook] = useState<FleetWorkbook | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    const now = new Date();
    Promise.all([api.fleetMe(), api.overview(), api.drivers(), loadFleetWorkbook(now.getFullYear(), now.getMonth() + 1)])
      .then(([m, o, d, b]) => { setMe(m); setOv(o); setDrivers(d.drivers || []); setBook(b); }).catch((e) => setErr(apiError(e)));
  }, []);
  if (!me || !ov) return err ? <ErrorBox message={err} /> : <Loading />;
  const recent = [...(book?.trips || [])].reverse().slice(0, 4);
  return <div className="page-content">
    <PageHead title={`God kveld, ${me.name}`} sub="Oversikt over egen virksomhet" />
    <div className="kpi-grid four">
      <div className="kpi-card"><span>TURER I DAG</span><strong>{ov.today.trips}</strong><small>{fmtMoney(ov.today.gross)} brutto</small></div>
      <div className="kpi-card"><span>SJÅFØRER</span><strong>{ov.drivers_online} / {ov.drivers_total}</strong><small>pålogget nå</small></div>
      <div className="kpi-card desktop-kpi-extra"><span>UKE NETTO</span><strong>{fmtMoney(ov.week.net)}</strong><small>etter {ov.commission_pct}% provisjon</small></div>
      <div className="kpi-card desktop-kpi-extra"><span>BILER PÅLOGGET</span><strong>{drivers.filter((d) => d.online).length}</strong><small>av {drivers.length} registrerte</small></div>
    </div>
    <div className="overview-grid"><LiveFleet drivers={drivers} /><div className="recent-card"><div className="eyebrow">SISTE TURER</div>{recent.length ? recent.map((t, i) => <div className="recent-row" key={`${t.tripId}-${i}`}><div><strong>{t.from || '—'} → {t.to || '—'}</strong><span>{t.driver}</span></div><b>{fmtMoney(t.price)}</b></div>) : <div className="empty-state">Ingen fullførte turer denne måneden.</div>}</div></div>
    <div className="mobile-week"><span>Denne uken</span><strong>{fmtMoney(ov.week.net)}</strong><small>{ov.week.trips} turer · netto etter provisjon</small></div>
    <div className="week-summary"><span>Denne uken</span><strong>{ov.week.trips} turer</strong><span>{fmtMoney(ov.week.gross)} brutto</span><span>{fmtMoney(ov.week.gross - ov.week.net)} KJAPP</span><b>{fmtMoney(ov.week.net)} netto</b></div>
    <ErrorBox message={err} />
  </div>;
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [car, setCar] = useState(''); const [plate, setPlate] = useState(''); const [email, setEmail] = useState(''); const [vehicle, setVehicle] = useState('ai-first'); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { await api.createInvite({ car, plate: plate.toUpperCase(), email: email || undefined, vehicle_type: vehicle, note }); onDone(); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">NY SJÅFØR</span><h2>Opprett invitasjon</h2></div><button type="button" className="icon-button" onClick={onClose}>×</button></div><p>Sjåføren registrerer seg via KJAPP sin eksisterende invitasjonsflyt.</p><input placeholder="Bilmodell" value={car} onChange={(e) => setCar(e.target.value)} required /><input placeholder="Skiltnummer" value={plate} onChange={(e) => setPlate(e.target.value)} required /><select value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="ai-first">Standard</option><option value="enkelt">Sparsom</option><option value="trygg">Komfort</option><option value="premium">Premium</option></select><input type="email" placeholder="E-post (valgfritt)" value={email} onChange={(e) => setEmail(e.target.value)} /><textarea placeholder="Kort notat (valgfritt)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} /><ErrorBox message={err} /><button className="primary-button" disabled={busy}>{busy ? 'Oppretter…' : 'Opprett invitasjon'}</button></form></div>;
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<FleetDriver[]>([]); const [invites, setInvites] = useState<any[]>([]); const [q, setQ] = useState(''); const [modal, setModal] = useState(false); const [err, setErr] = useState('');
  const load = () => Promise.all([api.drivers(), api.invites()]).then(([d, i]) => { setDrivers(d.drivers || []); setInvites(i.invites || []); }).catch((e) => setErr(apiError(e)));
  useEffect(() => { load(); }, []);
  const filtered = drivers.filter((d) => `${nameOf(d)} ${d.car || ''} ${d.plate || ''}`.toLowerCase().includes(q.toLowerCase()));
  return <div className="page-content"><PageHead title="Sjåfører" sub="Administrer personer og biler i din flåte" action={<button className="primary-button compact-button" onClick={() => setModal(true)}>+ Legg til sjåfør</button>} />
    <div className="table-card"><div className="table-tools"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk navn, skilt eller bil" /></div><div className="fleet-table driver-table"><div className="tr th"><span>SJÅFØR</span><span>BIL</span><span>STATUS</span><span>TURER I DAG</span><span>OMSETNING</span></div>{filtered.map((d) => <div className="tr" key={d.id}><span className="driver-name"><i className={`status-dot ${d.online ? 'on' : ''}`} />{nameOf(d)}</span><span>{d.car || '—'}{d.plate ? ` · ${d.plate}` : ''}</span><span className={d.online ? 'status-green' : 'muted'}>{d.online ? 'Pålogget' : 'Avlogget'}</span><span className="mono">{d.today_trips || 0}</span><span className="mono">{fmtMoney(d.today_income || 0)}</span></div>)}{!filtered.length ? <div className="empty-state padded">Ingen sjåfører funnet.</div> : null}</div></div>
    <section className="invites-section"><h2>Invitasjoner</h2><p>Opprett en invitasjon og send den til ny sjåfør.</p>{invites.length ? <div className="invite-chips">{invites.slice(0, 8).map((i) => <span key={i.token}>{i.email || i.plate || 'Invitasjon'} · {i.used ? 'Godtatt' : i.email_sent ? 'Sendt' : 'Venter'}</span>)}</div> : null}</section>
    <ErrorBox message={err} />{modal ? <InviteModal onClose={() => setModal(false)} onDone={() => { setModal(false); load(); }} /> : null}
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
