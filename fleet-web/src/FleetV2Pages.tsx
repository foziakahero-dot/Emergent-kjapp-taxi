import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  apiError,
  DriverInvite,
  FleetDocument,
  FleetDriver,
  FleetDriverDetail,
  FleetLive,
  FleetLiveDriver,
  FleetOverview,
  FleetTrip,
  FleetVehicle,
} from './api';
import { FleetMap } from './FleetMap';

const money = (value: unknown) => `${new Intl.NumberFormat('nb-NO').format(Math.round(Number(value) || 0))} kr`;
const shortDate = (value?: string) => value ? new Date(value).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) : '—';
const fullDate = (value?: string) => value ? new Date(value).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const driverName = (driver?: FleetDriver | FleetDriverDetail | null) => driver?.fullName || driver?.full_name || driver?.email || 'Sjåfør';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'SN';
const isPaidTrip = (trip: FleetTrip) => ['paid', 'captured', 'succeeded'].includes(String(trip.payment_status || '').toLowerCase()) || ['completed', 'rated', 'fullført'].includes(String(trip.status || '').toLowerCase());

function Avatar({ name, online = false, large = false }: { name: string; online?: boolean; large?: boolean }) {
  return <span className={`v2-avatar ${large ? 'large' : ''}`} aria-label={name}>
    {initials(name)}
    {online ? <i className="v2-presence" aria-label="Online" /> : null}
  </span>;
}

function StatusPill({ tone = 'neutral', children }: { tone?: 'green'|'red'|'amber'|'blue'|'neutral'; children: React.ReactNode }) {
  return <span className={`v2-status ${tone}`}>{children}</span>;
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return <div className="v2-section-title"><div><h2>{title}</h2>{sub ? <p>{sub}</p> : null}</div>{action}</div>;
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return <div className="v2-mini-bars" aria-label="Utvikling siste periode">
    {values.map((value, index) => <i key={index} style={{ height: `${Math.max(10, Math.round((value / max) * 100))}%` }} />)}
  </div>;
}

function PageChrome({ title, sub, children, actions }: { title: string; sub: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="v2-page">
    <div className="v2-page-head">
      <div><h1>{title}</h1><p>{sub}</p></div>
      <div className="v2-page-actions">{actions}</div>
    </div>
    {children}
  </div>;
}

function DashboardAlerts({ docs, pendingDrivers, stripeReady }: { docs: FleetDocument[]; pendingDrivers: number; stripeReady: boolean | null }) {
  const expiring = docs.filter((doc) => ['EXPIRING', 'EXPIRED'].includes(doc.compliance)).length;
  const items = [
    expiring ? { icon: '!', title: `${expiring} dokument${expiring === 1 ? '' : 'er'} krever oppfølging`, sub: 'Se dokumentoversikten', to: '/dokumenter', tone: 'red' } : null,
    pendingDrivers ? { icon: '↗', title: `${pendingDrivers} sjåfør${pendingDrivers === 1 ? '' : 'er'} venter oppfølging`, sub: 'Åpne sjåføroversikten', to: '/sjaforer', tone: 'amber' } : null,
    stripeReady === false ? { icon: '₦', title: 'Stripe Connect må fullføres', sub: 'Fullfør betalingsoppsett', to: '/okonomi', tone: 'blue' } : null,
  ].filter(Boolean) as Array<{ icon: string; title: string; sub: string; to: string; tone: string }>;

  return <div className="v2-card v2-alert-card">
    <SectionTitle title="Viktige varsler" sub="Det som trenger oppmerksomhet nå" />
    {items.length ? <div className="v2-alert-list">{items.map((item) => <Link key={item.title} to={item.to} className="v2-alert-row">
      <span className={`v2-alert-icon ${item.tone}`}>{item.icon}</span>
      <span><strong>{item.title}</strong><small>{item.sub}</small></span>
      <b>›</b>
    </Link>)}</div> : <div className="v2-empty-good"><span>✓</span><div><strong>Alt ser bra ut</strong><small>Ingen kritiske varsler akkurat nå.</small></div></div>}
  </div>;
}

export function OperationsDashboardPage() {
  const [overview, setOverview] = useState<FleetOverview | null>(null);
  const [live, setLive] = useState<FleetLive | null>(null);
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<'week'|'month'>('week');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [ov, lv, tr, dr, docs, pay, stripe] = await Promise.all([
          api.overview(), api.live(), api.trips(range === 'week' ? 14 : 45), api.drivers(), api.documents(), api.payouts(), api.stripeStatus().catch(() => null),
        ]);
        if (!alive) return;
        setOverview(ov); setLive(lv); setTrips(tr.trips || []); setDrivers(dr.drivers || []); setDocuments(docs.documents || []); setPayouts(pay.payouts || []);
        if (stripe) setStripeReady(Boolean((stripe as any).connected || (stripe as any).charges_enabled || (stripe as any).details_submitted));
        setError('');
      } catch (e) { if (alive) setError(apiError(e)); }
    };
    void load();
    const liveTimer = window.setInterval(() => api.live().then((value) => alive && setLive(value)).catch(() => {}), 5000);
    const dataTimer = window.setInterval(() => void load(), 30000);
    return () => { alive = false; window.clearInterval(liveTimer); window.clearInterval(dataTimer); };
  }, [range]);

  if (!overview && !error) return <div className="v2-loading"><span /></div>;
  if (!overview) return <div className="v2-error">{error || 'Kunne ikke laste Fleet-data.'}</div>;

  const liveDrivers = live?.drivers || [];
  const online = liveDrivers.filter((driver) => driver.online).length;
  const active = liveDrivers.filter((driver) => ['driver_on_way', 'at_pickup', 'in_trip'].includes(driver.operational_status || '')).length;
  const pendingDrivers = drivers.filter((driver) => !driver.approved || driver.fleet_active === false).length;
  const nextPayout = payouts.find((payout) => !['paid', 'completed'].includes(String(payout.status || '').toLowerCase())) || payouts[0];
  const recentTrips = [...trips].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 5);
  const paidToday = trips.filter((trip) => isPaidTrip(trip) && trip.created_at && new Date(trip.created_at).toDateString() === new Date().toDateString());
  const revenueSeries = trips.slice(0, 14).reverse().map((trip) => Number(trip.price || 0));

  return <PageChrome title="Oversikt" sub="Sanntid og nøkkeltall for din flåte." actions={<select className="v2-select" value={range} onChange={(event) => setRange(event.target.value as 'week'|'month')}><option value="week">Denne uken</option><option value="month">Denne måneden</option></select>}>
    <div className="v2-kpi-grid">
      <div className="v2-kpi"><span className="v2-kpi-icon green">↗</span><div><small>Omsetning</small><strong>{money(range === 'week' ? overview.week.gross : trips.reduce((sum, trip) => sum + Number(trip.price || 0), 0))}</strong><em>{range === 'week' ? `${overview.week.trips} turer denne uken` : `${trips.length} turer i perioden`}</em></div></div>
      <div className="v2-kpi"><span className="v2-kpi-icon blue">⌁</span><div><small>Antall turer</small><strong>{range === 'week' ? overview.week.trips : trips.length}</strong><em>{paidToday.length} betalte i dag</em></div></div>
      <div className="v2-kpi"><span className="v2-kpi-icon violet">●</span><div><small>Aktive sjåfører</small><strong>{online} / {overview.drivers_total}</strong><em>{active} på aktiv tur</em></div></div>
      <div className="v2-kpi"><span className="v2-kpi-icon red">▣</span><div><small>Neste utbetaling</small><strong>{nextPayout ? money(nextPayout.net ?? nextPayout.amount) : '—'}</strong><em>{nextPayout?.arrival_date ? fullDate(nextPayout.arrival_date) : nextPayout?.status || 'Ingen planlagt payout'}</em></div></div>
    </div>

    <div className="v2-dashboard-grid">
      <div className="v2-card v2-map-card">
        <SectionTitle title="Live flåte – Oslo" sub={`${online} online · ${active} på tur`} action={<Link className="v2-link-button" to="/live">Se alle</Link>} />
        <div className="v2-map-wrap"><FleetMap drivers={liveDrivers} /></div>
        <div className="v2-map-filters"><StatusPill tone="neutral">Alle {liveDrivers.length}</StatusPill><StatusPill tone="green">Online {online}</StatusPill><StatusPill tone="blue">På tur {active}</StatusPill><StatusPill tone="red">Offline {Math.max(0, overview.drivers_total - online)}</StatusPill></div>
      </div>
      <div className="v2-card v2-driver-status-card">
        <SectionTitle title="Sjåførstatus" sub="Direkte fra Fleet Live" action={<Link className="v2-link-button" to="/sjaforer">Se alle</Link>} />
        <div className="v2-driver-status-list">{liveDrivers.slice(0, 6).map((driver) => <Link key={driver.id} className="v2-driver-status-row" to={`/sjaforer/${driver.id}`}>
          <Avatar name={driver.name || driver.email || 'Sjåfør'} online={Boolean(driver.online)} />
          <span><strong>{driver.name || driver.email || 'Sjåfør'}</strong><small>{driver.car || 'Bil ikke registrert'}{driver.plate ? ` · ${driver.plate}` : ''}</small></span>
          <StatusPill tone={driver.online ? 'green' : 'red'}>{driver.online ? (driver.operational_status === 'available' ? 'Online' : 'Opptatt') : 'Offline'}</StatusPill>
        </Link>)}</div>
      </div>
    </div>

    <div className="v2-bottom-grid">
      <div className="v2-card v2-chart-card"><SectionTitle title="Omsetning" sub={range === 'week' ? 'Denne uken' : 'Valgt periode'} /><strong className="v2-big-money">{money(overview.week.gross)}</strong><MiniBars values={revenueSeries.length ? revenueSeries : [1, 2, 3, 2, 5, 4, 6]} /></div>
      <div className="v2-card v2-table-card"><SectionTitle title="Siste turer" sub="Betaling og status" action={<Link className="v2-link-button" to="/turer">Se alle</Link>} /><div className="v2-compact-table">{recentTrips.map((trip) => <div className="v2-trip-row" key={trip.trip_id}><span><strong>{trip.driver_name || 'Sjåfør'}</strong><small>{trip.pickup_address || 'Hentested'} → {trip.dropoff_address || 'Destinasjon'}</small></span><b>{money(trip.price)}</b><StatusPill tone={isPaidTrip(trip) ? 'green' : 'amber'}>{isPaidTrip(trip) ? 'Betalt' : trip.status || 'Pågår'}</StatusPill></div>)}{!recentTrips.length ? <div className="v2-empty-row">Ingen turer i perioden.</div> : null}</div></div>
      <DashboardAlerts docs={documents} pendingDrivers={pendingDrivers} stripeReady={stripeReady} />
    </div>
    {error ? <div className="v2-inline-error">{error}</div> : null}
  </PageChrome>;
}

function DriverDocuments({ driver }: { driver: FleetDriverDetail }) {
  const docs = driver.documents || [];
  return <div className="v2-driver-docs">{docs.length ? docs.map((doc) => {
    const good = String(doc.compliance || '').toUpperCase() === 'VALID' || String(doc.review_status || '').toLowerCase() === 'approved';
    return <div key={doc.id} className="v2-doc-row"><span className="v2-doc-icon">▤</span><span><strong>{doc.doc_type || doc.filename || 'Dokument'}</strong><small>{doc.expiry ? `Gyldig til ${fullDate(doc.expiry)}` : doc.filename || 'Lastet opp'}</small></span><StatusPill tone={good ? 'green' : 'amber'}>{good ? 'Godkjent' : 'Til kontroll'}</StatusPill></div>;
  }) : <div className="v2-empty-row">Ingen dokumenter registrert på sjåføren.</div>}</div>;
}

export function Driver360Page() {
  const { driverId = '' } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<FleetDriverDetail | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<FleetTrip[]>([]);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'overview'|'documents'|'trips'|'income'|'vehicle'>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [detail, vehicleData, tripData, stripe] = await Promise.all([api.driverDetail(driverId), api.vehicles(), api.trips(120), api.stripeStatus().catch(() => null)]);
      setDriver(detail); setVehicles(vehicleData.vehicles || []); setTrips((tripData.trips || []).filter((trip) => trip.driver_id === driverId));
      if (stripe) setStripeReady(Boolean((stripe as any).connected || (stripe as any).charges_enabled || (stripe as any).details_submitted));
      setError('');
    } catch (e) { setError(apiError(e)); }
  };
  useEffect(() => { void load(); }, [driverId]);

  if (!driver && !error) return <div className="v2-loading"><span /></div>;
  if (!driver) return <div className="v2-error">{error || 'Fant ikke sjåføren.'}</div>;

  const name = driverName(driver);
  const vehicle = vehicles.find((item) => item.driver_id === driver.id || item.id === (driver as any).vehicle_id);
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekTrips = trips.filter((trip) => !trip.created_at || new Date(trip.created_at).getTime() >= weekStart);
  const weekIncome = weekTrips.reduce((sum, trip) => sum + Number(trip.price || 0), 0);
  const totalIncome = trips.reduce((sum, trip) => sum + Number(trip.price || 0), 0);
  const incomeSeries = weekTrips.slice(0, 8).reverse().map((trip) => Number(trip.price || 0));

  const toggleActive = async () => {
    setBusy(true);
    try { await api.setDriverActive(driver.id, !(driver.fleet_active !== false)); await load(); }
    catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const activePanel = tab === 'overview' ? <>
    <div className="v2-driver-summary-grid">
      <div className="v2-card v2-vehicle-summary"><small>Tilknyttet kjøretøy</small><strong>{vehicle?.car || driver.car || 'Ingen bil tildelt'}</strong><span>{vehicle?.plate || driver.plate || '—'}</span><div className="v2-car-visual"><i /><i /><i /></div></div>
      <div className="v2-card v2-stat-tile"><small>Ukesinntekt</small><strong>{money(weekIncome)}</strong><span>{weekTrips.length} turer</span></div>
      <div className="v2-card v2-stat-tile"><small>Total inntekt</small><strong>{money(totalIncome)}</strong><span>{trips.length} registrerte turer</span></div>
    </div>
    <div className="v2-driver-main-grid">
      <div className="v2-card"><SectionTitle title="Sjåførinformasjon" /><dl className="v2-detail-list"><div><dt>Fullt navn</dt><dd>{name}</dd></div><div><dt>Telefon</dt><dd>{driver.phone || '—'}</dd></div><div><dt>E-post</dt><dd>{driver.email || '—'}</dd></div><div><dt>Sjåfør-ID</dt><dd>{driver.id}</dd></div><div><dt>Flåtestatus</dt><dd>{driver.fleet_active === false ? 'Deaktivert' : 'Aktiv'}</dd></div></dl></div>
      <div className="v2-card"><SectionTitle title="Status" /><div className="v2-check-list"><span className={driver.approved ? 'ok' : 'warn'}>{driver.approved ? '✓' : '!'} <b>Sjåfør {driver.approved ? 'godkjent' : 'venter godkjenning'}</b></span><span className={stripeReady ? 'ok' : 'warn'}>{stripeReady ? '✓' : '!'} <b>Stripe Connect {stripeReady ? 'aktiv' : 'må fullføres'}</b></span><span className={vehicle ? 'ok' : 'warn'}>{vehicle ? '✓' : '!'} <b>{vehicle ? `Tilknyttet ${vehicle.car || 'kjøretøy'}` : 'Ingen bil tildelt'}</b></span><span className={(driver.documents || []).length ? 'ok' : 'warn'}>{(driver.documents || []).length ? '✓' : '!'} <b>{(driver.documents || []).length ? 'Dokumenter registrert' : 'Dokumenter mangler'}</b></span></div><button className="v2-danger-ghost" type="button" disabled={busy} onClick={toggleActive}>{busy ? 'Lagrer…' : driver.fleet_active === false ? 'Aktiver sjåfør' : 'Deaktiver sjåfør'}</button></div>
    </div>
    <div className="v2-driver-lower-grid"><div className="v2-card"><SectionTitle title="Dokumenter" sub="Status og gyldighet" action={<button className="v2-link-button" type="button" onClick={() => setTab('documents')}>Se alle</button>} /><DriverDocuments driver={driver} /></div><div className="v2-card v2-chart-card"><SectionTitle title="Inntekt" sub="Denne uken" /><strong className="v2-big-money">{money(weekIncome)}</strong><MiniBars values={incomeSeries.length ? incomeSeries : [0, 0, 0, 0, 0, 0, 0]} /></div></div>
  </> : tab === 'documents' ? <div className="v2-card"><SectionTitle title="Dokumenter" sub={`Dokumentstatus for ${name}`} /><DriverDocuments driver={driver} /></div> : tab === 'trips' ? <div className="v2-card"><SectionTitle title="Turer" sub={`${trips.length} registrerte turer`} /><div className="v2-compact-table">{trips.slice(0, 30).map((trip) => <div className="v2-trip-row" key={trip.trip_id}><span><strong>{shortDate(trip.created_at)}</strong><small>{trip.pickup_address || 'Hentested'} → {trip.dropoff_address || 'Destinasjon'}</small></span><b>{money(trip.price)}</b><StatusPill tone={isPaidTrip(trip) ? 'green' : 'amber'}>{isPaidTrip(trip) ? 'Betalt' : trip.status || 'Pågår'}</StatusPill></div>)}</div></div> : tab === 'income' ? <div className="v2-card v2-income-panel"><SectionTitle title="Inntekt" sub="Registrert inntekt fra Fleet-turer" /><strong className="v2-income-total">{money(totalIncome)}</strong><MiniBars values={trips.slice(0, 14).reverse().map((trip) => Number(trip.price || 0))} /></div> : <div className="v2-card"><SectionTitle title="Kjøretøy" sub="Kjøretøy knyttet til sjåføren" />{vehicle ? <div className="v2-vehicle-detail"><div className="v2-car-visual large"><i /><i /><i /></div><div><h3>{vehicle.car || 'Kjøretøy'}</h3><p>{vehicle.plate || 'Registreringsnummer mangler'}</p><StatusPill tone={vehicle.active === false ? 'red' : 'green'}>{vehicle.active === false ? 'Inaktiv' : 'Aktiv'}</StatusPill></div></div> : <div className="v2-empty-row">Ingen bil er tildelt denne sjåføren.</div>}</div>;

  return <PageChrome title="Sjåførprofil" sub="Komplett operativ oversikt" actions={<><button className="v2-secondary" type="button" onClick={() => navigate('/sjaforer')}>← Til sjåfører</button><a className="v2-primary" href={driver.phone ? `sms:${driver.phone}` : `mailto:${driver.email || ''}`}>Send melding</a></>}>
    <div className="v2-profile-hero"><Avatar name={name} online={Boolean(driver.online)} large /><div className="v2-profile-identity"><div><h2>{name}</h2><StatusPill tone={driver.online ? 'green' : 'neutral'}>{driver.online ? 'Online' : 'Offline'}</StatusPill></div><p>{driver.phone || 'Telefon mangler'}</p><p>{driver.email || 'E-post mangler'}</p></div></div>
    <div className="v2-tabs" role="tablist">{([['overview','Oversikt'],['documents','Dokumenter'],['trips','Turer'],['income','Inntekt'],['vehicle','Kjøretøy']] as const).map(([key, label]) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>{label}</button>)}</div>
    {activePanel}
    {error ? <div className="v2-inline-error">{error}</div> : null}
  </PageChrome>;
}

function inviteStatus(invite: DriverInvite, drivers: FleetDriver[]) {
  const matched = drivers.find((driver) => driver.email && invite.email && driver.email.toLowerCase() === invite.email.toLowerCase());
  if (matched?.approved) return { label: 'Godkjent', tone: 'green' as const, step: 6 };
  if (matched) return { label: 'Venter admin', tone: 'amber' as const, step: 5 };
  if (invite.used) return { label: 'Registrert', tone: 'blue' as const, step: 4 };
  if (invite.email_sent) return { label: 'Invitert', tone: 'amber' as const, step: 2 };
  return { label: 'Lenke klar', tone: 'neutral' as const, step: 1 };
}

export function InvitationsPage() {
  const [invites, setInvites] = useState<DriverInvite[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [note, setNote] = useState('Velkommen til SNAR! Klikk på lenken for å fullføre registreringen.');
  const [createdUrl, setCreatedUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all'|'pending'|'registered'|'approved'>('all');

  const load = async () => {
    try {
      const [inviteData, driverData, vehicleData] = await Promise.all([api.invites(), api.drivers(), api.vehicles()]);
      setInvites(inviteData.invites || []); setDrivers(driverData.drivers || []); setVehicles(vehicleData.vehicles || []); setError('');
      if (!vehicleId && vehicleData.vehicles?.length) setVehicleId(vehicleData.vehicles[0].id);
    } catch (e) { setError(apiError(e)); }
  };
  useEffect(() => { void load(); }, []);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setCreatedUrl('');
    try {
      const context = [recipientName ? `Navn: ${recipientName}` : '', phone ? `Telefon: ${phone}` : '', note].filter(Boolean).join('\n');
      const result = await api.createInvite({ vehicle_id: vehicleId, email: email.trim(), note: context });
      const token = String((result as any).token || (result as any).invite?.token || '');
      if (token) setCreatedUrl(`${window.location.origin}/driver-signup/${token}`);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };

  const rows = useMemo(() => invites.map((invite) => ({ invite, state: inviteStatus(invite, drivers) })).filter(({ state }) => filter === 'all' || (filter === 'approved' && state.step === 6) || (filter === 'registered' && state.step >= 4 && state.step < 6) || (filter === 'pending' && state.step < 4)), [invites, drivers, filter]);
  const counts = { invited: invites.filter((invite) => invite.email_sent && !invite.used).length, opened: invites.filter((invite) => !invite.used).length, registered: drivers.filter((driver) => !driver.approved).length, approved: drivers.filter((driver) => driver.approved).length };

  return <PageChrome title="Inviter sjåfør" sub="Send invitasjon til ny sjåfør i din flåte.">
    <div className="v2-onboarding-steps"><div className="active"><b>1</b><span>Inviter sjåfør<small>Send lenke</small></span></div><i /><div><b>2</b><span>Sjåfør registrerer<small>Personlig info</small></span></div><i /><div><b>3</b><span>Laster opp dokumenter<small>Førerkort og kjøreseddel</small></span></div><i /><div><b>4</b><span>Admin godkjenner<small>Og tildeler tilgang</small></span></div></div>

    <div className="v2-invite-grid">
      <form className="v2-card v2-invite-form" onSubmit={submit}>
        <SectionTitle title="Invitasjonsdetaljer" sub="Invitasjonen knyttes direkte til din flåte" />
        <label>Navn<span>*</span><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Ahmed Raza" required /></label>
        <label>E-post<span>*</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="navn@firma.no" required /></label>
        <label>Telefon<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+47 900 00 000" /></label>
        <label>Tildel kjøretøy<span>*</span><select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required><option value="">Velg kjøretøy</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.car || 'Kjøretøy'} {vehicle.plate ? `(${vehicle.plate})` : ''}</option>)}</select></label>
        <label>Melding til sjåfør<textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button className="v2-primary full" disabled={busy || !vehicleId}>{busy ? 'Sender…' : 'Send invitasjon'}</button>
        {error ? <div className="v2-inline-error">{error}</div> : null}
        {createdUrl ? <div className="v2-success-box"><strong>Invitasjon opprettet</strong><p>{createdUrl}</p><button type="button" onClick={() => navigator.clipboard?.writeText(createdUrl)}>Kopier lenke</button></div> : null}
      </form>

      <div className="v2-card v2-email-preview">
        <SectionTitle title="Forhåndsvisning av e-post" sub="Slik oppleves invitasjonen" />
        <div className="v2-mail-brand"><span className="v2-mail-mark">S</span><b>SNAR</b></div>
        <div className="v2-phone-car-visual"><div className="v2-phone-mini">SNAR<br/><span>Driver</span></div><div className="v2-car-visual large"><i /><i /><i /></div></div>
        <h3>Du er invitert som sjåfør i SNAR</h3>
        <p>Hei {recipientName || 'sjåfør'},</p>
        <p>Du er invitert til å bli sjåfør i flåten. Registrer deg, last opp dokumentene dine og vent på godkjenning.</p>
        <div className="v2-preview-vehicle"><small>Tilknyttet kjøretøy</small><strong>{selectedVehicle?.car || 'Velg kjøretøy'}</strong><span>{selectedVehicle?.plate || ''}</span></div>
        <button type="button" className="v2-primary full" disabled>Registrer deg som sjåfør</button>
        <small className="v2-preview-note">Lenken er personlig og utløper automatisk.</small>
      </div>
    </div>

    <div className="v2-card v2-invite-table-card">
      <SectionTitle title="Invitasjoner" sub="Følg progresjonen fra invitasjon til godkjent sjåfør" />
      <div className="v2-filter-tabs"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle ({invites.length})</button><button type="button" className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Venter</button><button type="button" className={filter === 'registered' ? 'active' : ''} onClick={() => setFilter('registered')}>Registrert</button><button type="button" className={filter === 'approved' ? 'active' : ''} onClick={() => setFilter('approved')}>Godkjent</button></div>
      <div className="v2-invite-table"><div className="head"><span>E-post</span><span>Kjøretøy</span><span>Status</span><span>Sendt</span><span>Utløper</span></div>{rows.map(({ invite, state }) => <div className="row" key={invite.id || invite.token}><span><strong>{invite.email || 'Lenkeinvitasjon'}</strong></span><span>{invite.car || vehicles.find((vehicle) => vehicle.id === invite.vehicle_id)?.car || '—'}<small>{invite.plate || vehicles.find((vehicle) => vehicle.id === invite.vehicle_id)?.plate || ''}</small></span><span><StatusPill tone={state.tone}>{state.label}</StatusPill></span><span>{shortDate(invite.created_at)}</span><span>{shortDate(invite.expires_at)}</span></div>)}{!rows.length ? <div className="v2-empty-row">Ingen invitasjoner i dette filteret.</div> : null}</div>
    </div>

    <div className="v2-card v2-progress-card"><SectionTitle title="Onboarding-status" sub="Pipeline for sjåfører i din flåte" /><div className="v2-progress-flow"><div><b className="red">{invites.length}</b><span>Invitert</span></div><i /><div><b className="red">{counts.opened}</b><span>Lenke aktiv</span></div><i /><div><b className="blue">{counts.registered}</b><span>Registrert</span></div><i /><div><b className="green">{counts.approved}</b><span>Godkjent</span></div></div></div>
  </PageChrome>;
}
