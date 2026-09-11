import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
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

/* ----------------------------- Dashboard ----------------------------- */
export function Dashboard() {
  const ov = useAsync(() => api.overview(), []);
  const fin = useAsync(() => api.finance(30), []);
  if (ov.loading) return <Loader />;
  if (ov.err) return <ErrorBanner msg={ov.err} />;
  const d = ov.data || {};
  const delta = (d.trips?.today ?? 0) - (d.trips?.yesterday ?? 0);
  return (
    <>
      <PageHead title="Dashbord" sub={`Oppdatert ${fmtDate(d.as_of)}`} />
      <div className="grid cards">
        <Kpi label="Aktive turer nå" value={d.trips?.active ?? 0} accent
          foot={<span className="dim">{d.drivers?.online ?? 0} sjåfører online</span>} />
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
        <Shortcut ic="◉" n={d.trips?.active ?? 0} l="Aktive turer" c="blue" />
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
  return (
    <>
      <PageHead title="Live drift" sub={data ? `Oppdatert ${fmtDate(data.as_of)} · auto hvert 5s` : ''}
        right={<Btn variant="sm" onClick={reload}>Oppdater</Btn>} />
      <ErrorBanner msg={err} />
      {loading && !data ? <Loader /> : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Sjåfører online ({data?.drivers?.length || 0})</div>
            <div className="tablewrap">
              <table><thead><tr><th>Sjåfør</th><th>Kjøretøy</th><th>Løyvehaver</th><th>Sist sett</th></tr></thead>
                <tbody>
                  {(data?.drivers || []).map((x: any) => (
                    <tr key={x.id}><td className="strong">{x.name}</td>
                      <td>{x.car} <span className="dim mono">{x.plate}</span></td>
                      <td className="dim">{x.fleet_name || '—'}</td>
                      <td className="dim nowrap">{fmtDate(x.last_location_at)}</td></tr>
                  ))}
                  {!data?.drivers?.length && <tr><td colSpan={4}><Empty title="Ingen sjåfører online" /></td></tr>}
                </tbody></table>
            </div>
          </div>
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Aktive turer ({data?.trips?.length || 0})</div>
            <div className="tablewrap">
              <table><thead><tr><th>Status</th><th>Rute</th><th>Sjåfør</th><th className="right">Pris</th></tr></thead>
                <tbody>
                  {(data?.trips || []).map((x: any) => (
                    <tr key={x.trip_id}><td><Pill status={x.status} /></td>
                      <td><div>{x.pickup_address}</div><div className="cell-sub">→ {x.dropoff_address}</div></td>
                      <td>{x.driver_name || <span className="dim">—</span>}</td>
                      <td className="right mono">{fmtMoney(x.price)}</td></tr>
                  ))}
                  {!data?.trips?.length && <tr><td colSpan={4}><Empty title="Ingen aktive turer" /></td></tr>}
                </tbody></table>
            </div>
          </div>
        </div>
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
                <td className="mono">{d.completed ?? 0}</td>
                <td className="mono">{d.rating ? `${d.rating}★` : '—'}</td>
                <td>{d.online ? <Pill status="in_trip" label="Online" /> : d.approved ? <Pill status="completed" label="Godkjent" /> : <Pill status="pending" label="Venter" />}</td>
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
                <td>{v.online ? <Pill status="in_trip" label="Online" /> : <Pill status={v.approved ? 'completed' : 'pending'} label={v.approved ? 'Aktiv' : 'Venter'} />}</td>
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
export function Settings() {
  const { user } = useAuth();
  const { data, loading, err, reload } = useAsync(() => api.list('/admin/settings', {}), []);
  const [comm, setComm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data?.default_commission != null) setComm(String(Math.round(data.default_commission * 100))); }, [data]);
  const isSuper = user?.role === 'superadmin';
  const save = async () => {
    setBusy(true); setMsg('');
    try { await api.patchSettings({ default_commission: Number(comm) / 100 }); setMsg('Lagret'); reload(); }
    catch (e: any) { setMsg(e?.response?.data?.detail || 'Feil'); }
    finally { setBusy(false); }
  };
  if (loading) return <Loader />;
  return (
    <>
      <PageHead title="Innstillinger" sub={`Sist oppdatert ${fmtDate(data?.updated_at)}`} />
      <ErrorBanner msg={err} />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 820 }}>
        <Card>
          <div className="section-title" style={{ marginTop: 0 }}>Provisjon</div>
          <div className="field"><label className="label">Standard KJAPP-provisjon (%)</label>
            <input className="input" type="number" value={comm} disabled={!isSuper} onChange={(e) => setComm(e.target.value)} /></div>
          {isSuper ? <Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre'}</Btn>
            : <div className="dim" style={{ fontSize: 12 }}>Kun superadmin kan endre.</div>}
          {msg && <div style={{ marginTop: 10, color: 'var(--green)', fontSize: 13 }}>{msg}</div>}
        </Card>
        <Card>
          <div className="section-title" style={{ marginTop: 0 }}>Funksjoner</div>
          {Object.entries(data?.features || {}).map(([k, v]) => (
            <KV key={k} k={k} v={<Pill status={v ? 'completed' : 'gray'} label={v ? 'På' : 'Av'} />} />
          ))}
          {!Object.keys(data?.features || {}).length && <div className="dim">Ingen funksjonsflagg.</div>}
        </Card>
      </div>
      <div className="section-title">Kjøretøyklasser</div>
      <Card>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {(data?.ride_classes || []).map((r: any, i: number) => (
            <div key={i}><div className="strong">{r.name || r.type}</div>
              <div className="dim" style={{ fontSize: 12 }}>×{r.multiplier ?? r.price_multiplier ?? 1}</div></div>
          ))}
          {!data?.ride_classes?.length && <div className="dim">Ingen klasser definert.</div>}
        </div>
      </Card>
    </>
  );
}
