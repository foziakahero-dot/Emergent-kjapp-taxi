
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from './api';
import { useAuth } from './auth';
import { Btn, Card, Drawer, Empty, ErrorBanner, Kpi, KV, Loader, Modal, PageHead, Pill, fmtDate, fmtMoney, useAsync } from './ui';

const PERM_LABELS: Record<string, string> = {
  operations: 'Drift & flåte',
  finance: 'Økonomi & oppgjør',
  support: 'Support',
  communications: 'Kommunikasjon',
  system: 'System & audit',
};

function fleetStatus(f: any) {
  return f?.status === 'suspended' || f?.active === false
    ? <Pill status="failed" label="Suspendert" />
    : <Pill status="completed" label="Aktiv" />;
}
function StripePill({ fleet }: { fleet: any }) {
  if (!fleet?.stripe_account_id) return <Pill status="gray" label="Ikke koblet" />;
  if (fleet?.payouts_enabled || fleet?.stripe_payouts_enabled) return <Pill status="completed" label="Klar for utbetaling" />;
  return <Pill status="pending" label="KYC pågår" />;
}

export function FleetManagement() {
  const state = useAsync(() => api.controlFleets(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const fleets = state.data?.fleets || state.data?.items || [];
  return <>
    <PageHead title="Løyvehavere" sub={String(fleets.length) + ' løyvehavere · flåte, sjåfører, kjøretøy og oppgjør'}
      right={<Btn variant="primary" onClick={() => setCreateOpen(true)}>+ Ny løyvehaver</Btn>} />
    <ErrorBanner msg={state.err} />
    {state.loading ? <Loader /> : <div className="tablewrap"><table>
      <thead><tr><th>Løyvehaver</th><th>Org.nr.</th><th>Sjåfører</th><th>Provisjon</th><th>Stripe</th><th>Status</th><th /></tr></thead>
      <tbody>
        {fleets.map((f: any) => <tr key={f.id} className="click" onClick={() => setSelected(f.id)}>
          <td><div className="strong">{f.name}</div><div className="cell-sub">{f.contact_email || f.owner_email || '—'}</div></td>
          <td className="mono dim">{f.org_number || '—'}</td><td className="mono">{f.driver_count ?? f.drivers ?? 0}</td>
          <td className="mono">{Math.round(Number(f.commission_rate ?? .12) * 100)}%</td><td><StripePill fleet={f} /></td>
          <td>{fleetStatus(f)}</td><td className="right dim">Åpne ›</td>
        </tr>)}
        {!fleets.length && <tr><td colSpan={7}><Empty title="Ingen løyvehavere" sub="Godkjente søknader vises her automatisk." /></td></tr>}
      </tbody>
    </table></div>}
    {createOpen && <CreateFleetModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); state.reload(); }} />}
    {selected && <FleetDrawer id={selected} onClose={() => setSelected(null)} onChanged={state.reload} />}
  </>;
}

function CreateFleetModal({ onClose, onDone }: any) {
  const [form, setForm] = useState({ name: '', org_number: '', owner_email: '', commission: '12' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api.createFleet({ name: form.name.trim(), org_number: form.org_number.trim(), owner_email: form.owner_email.trim(), commission_rate: Number(form.commission) / 100 });
      onDone();
    } catch (e) { setErr(apiError(e)); setBusy(false); }
  };
  return <Modal title="Ny løyvehaver" sub="For manuell onboarding. Ordinære søkere går fortsatt via Løyvesøknader." onClose={onClose}>
    <ErrorBanner msg={err} />
    <div className="field"><label className="label">Firmanavn</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
    <div className="field"><label className="label">Org.nr.</label><input className="input" value={form.org_number} onChange={e => setForm({ ...form, org_number: e.target.value })} /></div>
    <div className="field"><label className="label">Eier / kontakt e-post</label><input className="input" type="email" value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} /></div>
    <div className="field"><label className="label">KJAPP-provisjon (%)</label><input className="input" type="number" min="0" max="50" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} /></div>
    <div className="modal-actions"><Btn onClick={onClose}>Avbryt</Btn><Btn variant="primary" disabled={busy || !form.name || !form.owner_email} onClick={save}>{busy ? 'Oppretter…' : 'Opprett løyvehaver'}</Btn></div>
  </Modal>;
}

function FleetDrawer({ id, onClose, onChanged }: any) {
  const state = useAsync(() => api.fleetDetail(id), [id]);
  const [mode, setMode] = useState('none');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const data: any = state.data || {}; const f = data.fleet || {}; const drivers = data.drivers || [];
  const connectStripe = async () => {
    setBusy(true); setMsg('');
    try { const r = await api.stripeConnect(id); if (r.onboarding_url) window.open(r.onboarding_url, '_blank', 'noopener,noreferrer'); setMsg('Stripe onboarding åpnet.'); state.reload(); onChanged(); }
    catch (e) { setMsg(apiError(e)); } finally { setBusy(false); }
  };
  const refreshStripe = async () => {
    setBusy(true); setMsg('');
    try { const r = await api.stripeStatus(id); setMsg(r.ready ? 'Stripe Connect er klar for automatiske utbetalinger.' : 'Stripe mangler: ' + ((r.currently_due || []).join(', ') || 'verifisering')); state.reload(); onChanged(); }
    catch (e) { setMsg(apiError(e)); } finally { setBusy(false); }
  };
  const toggleFleet = async () => {
    setBusy(true); setMsg('');
    try { if (f.status === 'suspended' || f.active === false) await api.reactivateFleet(id); else await api.suspendFleet(id, 'Suspendert fra kontrollsenter'); state.reload(); onChanged(); }
    catch (e) { setMsg(apiError(e)); } finally { setBusy(false); }
  };
  return <Drawer title={f.name || 'Løyvehaver'} onClose={onClose}>
    {state.loading ? <Loader /> : state.err ? <ErrorBanner msg={state.err} /> : <>
      {msg && <div className={msg.includes('klar for') ? 'ok-banner' : 'info-banner'}>{msg}</div>}
      <div className="fleet-actions">
        <Btn variant="primary" onClick={() => setMode('driver')}>+ Legg til sjåfør</Btn>
        <Btn onClick={() => setMode('vehicle')}>+ Legg til kjøretøy</Btn>
        <Btn onClick={() => setMode('commission')}>Endre provisjon</Btn>
        <Btn onClick={connectStripe} disabled={busy}>{f.stripe_account_id ? 'Fortsett Stripe' : 'Koble Stripe'}</Btn>
        {f.stripe_account_id && <Btn onClick={refreshStripe} disabled={busy}>Oppdater Stripe-status</Btn>}
        <Btn variant="danger" onClick={toggleFleet} disabled={busy}>{f.status === 'suspended' || f.active === false ? 'Reaktiver' : 'Suspender'}</Btn>
      </div>
      <Card><KV k="Org.nr." v={f.org_number || '—'} /><KV k="Status" v={f.status || (f.active === false ? 'suspended' : 'active')} /><KV k="Provisjon" v={String(Math.round(Number(f.commission_rate ?? .12) * 100)) + '%'} /><KV k="Stripe-konto" v={f.stripe_account_id || 'Ikke koblet'} /></Card>
      {mode === 'driver' && <InviteDriver fleetId={id} onDone={() => { setMode('none'); state.reload(); }} />}
      {mode === 'vehicle' && <VehicleEditor fleetId={id} drivers={drivers} onDone={() => { setMode('none'); state.reload(); }} />}
      {mode === 'commission' && <CommissionEditor fleetId={id} current={Number(f.commission_rate ?? .12)} onDone={() => { setMode('none'); state.reload(); onChanged(); }} />}
      <div className="section-title">Sjåfører ({drivers.length})</div>
      <div className="tablewrap"><table><thead><tr><th>Sjåfør</th><th>Kjøretøy</th><th>Status</th><th>Vurd.</th></tr></thead><tbody>
        {drivers.map((d: any) => <tr key={d.id}><td><div className="strong">{d.name || d.email}</div><div className="cell-sub">{d.email}</div></td><td>{d.car || '—'} <span className="mono dim">{d.plate || ''}</span></td><td><Pill status={d.approved ? 'completed' : 'pending'} label={d.approved ? (d.online ? 'Godkjent · online' : 'Godkjent · offline') : 'Venter godkjenning'} /></td><td>{d.rating ?? '—'}</td></tr>)}
        {!drivers.length && <tr><td colSpan={4}><Empty title="Ingen sjåfører i flåten" /></td></tr>}
      </tbody></table></div>
      <div className="section-title">Oppgjør</div>
      <div className="tablewrap"><table><thead><tr><th>Periode</th><th>Status</th><th className="right">Beløp</th></tr></thead><tbody>
        {(data.payouts || []).map((p: any) => <tr key={p.id}><td>{p.period_start || '—'} – {p.period_end || '—'}</td><td><Pill status={p.status} /></td><td className="right mono">{fmtMoney(p.net_amount ?? p.amount)}</td></tr>)}
        {!data.payouts?.length && <tr><td colSpan={3}><Empty title="Ingen oppgjør registrert ennå" /></td></tr>}
      </tbody></table></div>
      <div className="section-title">Audit</div><Card className="compact-list">{(data.audit || []).slice(0, 10).map((a: any) => <div className="audit-row" key={a.id}><span>{a.action}</span><span className="dim">{fmtDate(a.at)}</span></div>)}{!data.audit?.length && <div className="dim">Ingen hendelser.</div>}</Card>
    </>}
  </Drawer>;
}

function InviteDriver({ fleetId, onDone }: any) {
  const [form, setForm] = useState({ email: '', car: '', plate: '', vehicle_type: 'ai-first', note: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { await api.inviteFleetDriver(fleetId, form); onDone(); } catch (e) { setErr(apiError(e)); setBusy(false); } };
  return <Card className="action-card"><div className="strong">Inviter sjåfør til flåten</div><div className="cell-sub">Sjåføren registrerer dokumenter og må godkjennes før kjøring.</div><ErrorBanner msg={err} />
    <div className="form-grid two"><input className="input" type="email" placeholder="E-post" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><input className="input" placeholder="Bilmodell" value={form.car} onChange={e => setForm({ ...form, car: e.target.value })} /><input className="input" placeholder="Registreringsnummer" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} /><select className="select" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}><option value="ai-first">KJAPP Standard</option><option value="xl">KJAPP XL</option><option value="premium">Premium</option></select></div>
    <textarea className="textarea" placeholder="Notat (valgfritt)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
    <div className="modal-actions"><Btn onClick={onDone}>Avbryt</Btn><Btn variant="primary" onClick={save} disabled={busy || !form.email || !form.car || !form.plate}>{busy ? 'Sender…' : 'Send invitasjon'}</Btn></div>
  </Card>;
}
function VehicleEditor({ fleetId, drivers, onDone }: any) {
  const [form, setForm] = useState({ driver_user_id: drivers[0]?.id || '', car: '', plate: '', vehicle_type: 'ai-first' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { await api.updateFleetVehicle(fleetId, form); onDone(); } catch (e) { setErr(apiError(e)); setBusy(false); } };
  return <Card className="action-card"><div className="strong">Legg til / endre kjøretøy</div><div className="cell-sub">Kjøretøy er knyttet til sjåfør i dagens datamodell.</div><ErrorBanner msg={err} /><select className="select" value={form.driver_user_id} onChange={e => setForm({ ...form, driver_user_id: e.target.value })}><option value="">Velg sjåfør</option>{drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name || d.email}</option>)}</select><div className="form-grid two"><input className="input" placeholder="Bilmodell" value={form.car} onChange={e => setForm({ ...form, car: e.target.value })} /><input className="input" placeholder="Registreringsnummer" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} /><select className="select" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}><option value="ai-first">KJAPP Standard</option><option value="xl">KJAPP XL</option><option value="premium">Premium</option></select></div><div className="modal-actions"><Btn onClick={onDone}>Avbryt</Btn><Btn variant="primary" onClick={save} disabled={busy || !form.driver_user_id || !form.car || !form.plate}>{busy ? 'Lagrer…' : 'Lagre kjøretøy'}</Btn></div></Card>;
}
function CommissionEditor({ fleetId, current, onDone }: any) {
  const [value, setValue] = useState(String(Math.round(current * 100))); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { await api.updateFleetCommission(fleetId, Number(value) / 100, reason); onDone(); } catch (e) { setErr(apiError(e)); setBusy(false); } };
  return <Card className="action-card"><div className="strong">Endre provisjon</div><ErrorBanner msg={err} /><div className="form-grid two"><input className="input" type="number" min="0" max="50" value={value} onChange={e => setValue(e.target.value)} /><input className="input" placeholder="Begrunnelse" value={reason} onChange={e => setReason(e.target.value)} /></div><div className="modal-actions"><Btn onClick={onDone}>Avbryt</Btn><Btn variant="primary" disabled={busy} onClick={save}>{busy ? 'Lagrer…' : 'Lagre provisjon'}</Btn></div></Card>;
}

export function PaymentsPayouts() {
  const state = useAsync(async () => {
    const values = await Promise.all([api.finance(30), api.stripeFleets(), api.stripePayouts(), api.list('/admin/transactions', { page: 1, page_size: 50 })]);
    return { finance: values[0], stripe: values[1], payouts: values[2], tx: values[3] };
  }, []);
  const [busyId, setBusyId] = useState(''); const [msg, setMsg] = useState('');
  if (state.loading) return <Loader />;
  const d: any = state.data || {}; const totals = d.finance?.totals || {}; const fleets = d.stripe?.fleets || []; const payoutRows = d.payouts?.payouts || []; const txRows = d.tx?.items || d.tx?.transactions || [];
  const start = async (id: string) => { setBusyId(id); setMsg(''); try { const r = await api.stripeConnect(id); if (r.onboarding_url) window.open(r.onboarding_url, '_blank', 'noopener,noreferrer'); setMsg('Stripe onboarding åpnet.'); } catch (e) { setMsg(apiError(e)); } finally { setBusyId(''); state.reload(); } };
  const refresh = async (id: string) => { setBusyId(id); setMsg(''); try { const r = await api.stripeStatus(id); setMsg(r.ready ? 'Løyvehaveren er klar for automatiske utbetalinger.' : 'Mangler: ' + ((r.currently_due || []).join(', ') || 'Stripe-verifisering')); } catch (e) { setMsg(apiError(e)); } finally { setBusyId(''); state.reload(); } };
  return <>
    <PageHead title="Betaling & oppgjør" sub="Stripe Connect · KJAPP-provisjon · bankutbetalinger" /><ErrorBanner msg={state.err} />{msg && <div className="info-banner">{msg}</div>}
    <div className="grid cards"><Kpi label="Brutto siste 30 dager" value={fmtMoney(totals.gmv)} accent /><Kpi label="KJAPP-inntekt" value={fmtMoney(totals.kjapp_revenue)} accent /><Kpi label="Turer" value={totals.trips ?? 0} /><Kpi label="Stripe Connect klare" value={String(fleets.filter((f: any) => f.payouts_enabled).length) + '/' + String(fleets.length)} /></div>
    <div className="section-title">Løyvehavere · Stripe Connect</div><div className="tablewrap"><table><thead><tr><th>Løyvehaver</th><th>Provisjon</th><th>Stripe</th><th>Utbetalingsplan</th><th className="right">Handling</th></tr></thead><tbody>
      {fleets.map((f: any) => <tr key={f.id}><td><div className="strong">{f.name}</div><div className="cell-sub">{f.owner_email || f.org_number || '—'}</div></td><td className="mono">{Math.round(Number(f.commission_rate ?? .12) * 100)}%</td><td><StripePill fleet={f} /></td><td>Ukentlig · fredag</td><td className="right"><div className="inline-actions"><Btn variant="sm" disabled={busyId === f.id} onClick={() => start(f.id)}>{f.stripe_account_id ? 'Fortsett onboarding' : 'Koble Stripe'}</Btn>{f.stripe_account_id && <Btn variant="sm" disabled={busyId === f.id} onClick={() => refresh(f.id)}>Oppdater status</Btn>}</div></td></tr>)}
      {!fleets.length && <tr><td colSpan={5}><Empty title="Ingen løyvehavere" /></td></tr>}
    </tbody></table></div>
    <div className="section-title">Faktiske Stripe-utbetalinger</div><div className="tablewrap"><table><thead><tr><th>Løyvehaver</th><th>Payout-ID</th><th>Status</th><th>Ankomst</th><th className="right">Beløp</th></tr></thead><tbody>
      {payoutRows.map((p: any) => <tr key={p.id}><td>{p.fleet_name}</td><td className="mono dim">{p.id}</td><td><Pill status={p.status} /></td><td>{fmtDate(p.arrival_date)}</td><td className="right mono">{fmtMoney(p.amount)}</td></tr>)}{!payoutRows.length && <tr><td colSpan={5}><Empty title="Ingen Stripe-utbetalinger å vise" sub="Vises når connected accounts har bankutbetalinger." /></td></tr>}
    </tbody></table></div>
    <div className="section-title">Transaksjoner</div><div className="tablewrap"><table><thead><tr><th>Type</th><th>Referanse</th><th>Status</th><th>Tid</th><th className="right">Beløp</th></tr></thead><tbody>
      {txRows.map((t: any, i: number) => <tr key={t.id || i}><td><Pill status="gray" label={t.type} /></td><td className="mono dim">{t.ride || t.trip_id || t.recipient || '—'}</td><td><Pill status={t.status} /></td><td>{fmtDate(t.timestamp || t.created_at)}</td><td className="right mono">{fmtMoney(t.amount)}</td></tr>)}{!txRows.length && <tr><td colSpan={5}><Empty title="Ingen transaksjoner" /></td></tr>}
    </tbody></table></div>
  </>;
}

export function Communications() {
  const history = useAsync(() => api.communications(), []); const fleetsState = useAsync(() => api.controlFleets(), []);
  const [form, setForm] = useState<any>({ title: '', body: '', audience: 'drivers', fleet_id: '', channels: ['push'] });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const toggle = (c: string) => setForm({ ...form, channels: form.channels.includes(c) ? form.channels.filter((x: string) => x !== c) : [...form.channels, c] });
  const send = async () => { setBusy(true); setErr(''); setMsg(''); try { const r = await api.sendCommunication(form); setMsg('Sendt til ' + r.recipient_count + ' mottakere · push-mål ' + r.push_targeted + ' · e-post sendt ' + r.email_sent); setForm({ ...form, title: '', body: '' }); history.reload(); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); } };
  const fleets = fleetsState.data?.fleets || [];
  return <>
    <PageHead title="Kommunikasjon" sub="Send driftsmeldinger til kunder, sjåfører og løyvehavere" />
    <div className="control-two"><Card><div className="section-title" style={{ marginTop: 0 }}>Ny melding</div><ErrorBanner msg={err} />{msg && <div className="ok-banner">{msg}</div>}
      <div className="field"><label className="label">Mottakere</label><select className="select" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option value="all">Alle brukere</option><option value="customers">Alle kunder</option><option value="drivers">Alle sjåfører</option><option value="fleet_owners">Alle løyvehavere</option><option value="fleet">Én løyvehaver + hele flåten</option></select></div>
      {form.audience === 'fleet' && <div className="field"><label className="label">Løyvehaver</label><select className="select" value={form.fleet_id} onChange={e => setForm({ ...form, fleet_id: e.target.value })}><option value="">Velg…</option>{fleets.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      <div className="field"><label className="label">Tittel</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Viktig driftsmelding" /></div>
      <div className="field"><label className="label">Melding</label><textarea className="textarea tall" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Skriv meldingen som skal sendes…" /></div>
      <div className="channel-row"><label><input type="checkbox" checked={form.channels.includes('push')} onChange={() => toggle('push')} /> Push</label><label><input type="checkbox" checked={form.channels.includes('email')} onChange={() => toggle('email')} /> E-post</label></div>
      <Btn variant="primary" disabled={busy || !form.title || !form.body || !form.channels.length || (form.audience === 'fleet' && !form.fleet_id)} onClick={send}>{busy ? 'Sender…' : 'Send nå'}</Btn>
    </Card><Card><div className="section-title" style={{ marginTop: 0 }}>Forhåndsvisning</div><div className="message-preview"><div className="strong">{form.title || 'Tittel på meldingen'}</div><div>{form.body || 'Meldingen vises her før du sender.'}</div><div className="cell-sub">KJAPP · {form.channels.join(' + ') || 'ingen kanal valgt'}</div></div></Card></div>
    <div className="section-title">Sendte meldinger</div>{history.loading ? <Loader /> : <div className="tablewrap"><table><thead><tr><th>Tid</th><th>Melding</th><th>Målgruppe</th><th>Kanaler</th><th>Mottakere</th><th>E-post sendt</th></tr></thead><tbody>
      {(history.data?.broadcasts || []).map((b: any) => <tr key={b.id}><td>{fmtDate(b.created_at)}</td><td><div className="strong">{b.title}</div><div className="cell-sub">{String(b.body || '').slice(0, 80)}</div></td><td>{b.audience}</td><td>{(b.channels || []).join(', ')}</td><td className="mono">{b.recipient_count}</td><td className="mono">{b.email_sent ?? 0}</td></tr>)}{!history.data?.broadcasts?.length && <tr><td colSpan={6}><Empty title="Ingen meldinger sendt ennå" /></td></tr>}
    </tbody></table></div>}
  </>;
}

export function ActionCenter() {
  const nav = useNavigate(); const state = useAsync(() => api.controlActionCenter(), []);
  if (state.loading) return <Loader />;
  const s: any = state.data?.summary || {};
  return <>
    <PageHead title="Krever handling" sub={'Oppdatert ' + fmtDate(state.data?.as_of)} /><ErrorBanner msg={state.err} />
    <div className="grid cards"><Kpi label="Løyvesøknader" value={s.pending_applications ?? 0} /><Kpi label="Sjåfører venter" value={s.pending_drivers ?? 0} /><Kpi label="Betaling/oppgjør feilet" value={(s.failed_payments ?? 0) + (s.failed_payouts ?? 0)} accent /><Kpi label="Stripe Connect mangler" value={s.stripe_pending ?? 0} /></div>
    <div className="section-title">Oppgaver</div><div className="tablewrap"><table><thead><tr><th>Prioritet</th><th>Oppgave</th><th>Antall</th><th className="right">Handling</th></tr></thead><tbody>
      {(state.data?.items || []).map((x: any) => <tr key={x.type}><td><Pill status={x.severity === 'red' ? 'failed' : x.severity === 'amber' ? 'pending' : 'blue'} label={x.severity === 'red' ? 'Kritisk' : x.severity === 'amber' ? 'Må behandles' : 'Åpen'} /></td><td><div className="strong">{x.title}</div><div className="cell-sub">{x.detail}</div></td><td className="mono">{x.count}</td><td className="right"><Btn variant="sm" onClick={() => nav(x.href)}>Åpne ›</Btn></td></tr>)}{!state.data?.items?.length && <tr><td colSpan={4}><Empty title="Alt ser ryddig ut" sub="Ingen åpne oppgaver akkurat nå." /></td></tr>}
    </tbody></table></div>
  </>;
}

export function SystemIntegrations() {
  const state = useAsync(() => api.controlIntegrations(), []);
  return <>
    <PageHead title="System & integrasjoner" sub="Produksjonsstatus for kritiske KJAPP-tjenester" right={<Btn onClick={state.reload}>Oppdater</Btn>} /><ErrorBanner msg={state.err} />
    {state.loading ? <Loader /> : <div className="integration-grid">{(state.data?.integrations || []).map((i: any) => <Card key={i.id}><div className="integration-head"><div><div className="strong">{i.name}</div><div className="cell-sub">{i.detail}</div></div><Pill status={i.status === 'operational' ? 'completed' : 'pending'} label={i.status === 'operational' ? 'Operational' : 'Warning'} /></div><div className="integration-meta"><span className="dim">Konfigurert</span><span>{i.configured ? 'Ja' : 'Nei'}</span></div></Card>)}</div>}
  </>;
}

export function AdminRoles() {
  const { user } = useAuth(); const state = useAsync(() => api.adminUsers(), []);
  const [createOpen, setCreateOpen] = useState(false); const [edit, setEdit] = useState<any>(null);
  if (user?.role !== 'superadmin') return <><PageHead title="Administratorer" /><ErrorBanner msg="Kun superadmin kan administrere tilganger." /></>;
  return <>
    <PageHead title="Administratorer & tilganger" sub="Minste nødvendige tilgang per medarbeider" right={<Btn variant="primary" onClick={() => setCreateOpen(true)}>+ Ny administrator</Btn>} /><ErrorBanner msg={state.err} />
    {state.loading ? <Loader /> : <div className="tablewrap"><table><thead><tr><th>Administrator</th><th>Rolle</th><th>Tilganger</th><th>2FA</th><th>Status</th><th className="right">Handling</th></tr></thead><tbody>
      {(state.data?.users || []).map((u: any) => <tr key={u.id}><td><div className="strong">{u.fullName || u.email}</div><div className="cell-sub">{u.email}</div></td><td><Pill status="gray" label={u.role} /></td><td>{u.role === 'superadmin' ? 'Full tilgang' : (u.permissions || []).map((p: string) => PERM_LABELS[p] || p).join(' · ') || 'Ingen eksplisitte tilganger'}</td><td><Pill status={u.totp_enabled ? 'completed' : 'pending'} label={u.totp_enabled ? 'Aktiv' : 'Mangler'} /></td><td><Pill status={u.disabled ? 'failed' : 'completed'} label={u.disabled ? 'Deaktivert' : 'Aktiv'} /></td><td className="right">{u.role !== 'superadmin' && <Btn variant="sm" onClick={() => setEdit(u)}>Rediger</Btn>}</td></tr>)}
    </tbody></table></div>}
    {createOpen && <AdminUserModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); state.reload(); }} />}
    {edit && <EditAdminModal user={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); state.reload(); }} />}
  </>;
}

function PermissionChecks({ selected, onChange }: any) {
  return <div className="permission-grid">{Object.entries(PERM_LABELS).map(([k, v]) => <label key={k} className="permission-item"><input type="checkbox" checked={selected.includes(k)} onChange={() => onChange(selected.includes(k) ? selected.filter((x: string) => x !== k) : [...selected, k])} /><span>{v}</span></label>)}</div>;
}
function AdminUserModal({ onClose, onDone }: any) {
  const [form, setForm] = useState<any>({ email: '', full_name: '', permissions: ['operations'] }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [temp, setTemp] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { const r = await api.createAdminUser(form); setTemp(r.temp_password); } catch (e) { setErr(apiError(e)); setBusy(false); } };
  return <Modal title="Ny administrator" sub="Kontoen får midlertidig passord og eksplisitte tilganger." onClose={onClose}><ErrorBanner msg={err} />{temp ? <><div className="ok-banner">Administrator opprettet. Midlertidig passord vises bare nå.</div><div className="secret-box mono">{temp}</div><Btn variant="primary" className="full" onClick={onDone}>Ferdig</Btn></> : <><div className="field"><label className="label">Navn</label><input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div><div className="field"><label className="label">E-post</label><input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><div className="field"><label className="label">Tilganger</label><PermissionChecks selected={form.permissions} onChange={(p: string[]) => setForm({ ...form, permissions: p })} /></div><div className="modal-actions"><Btn onClick={onClose}>Avbryt</Btn><Btn variant="primary" disabled={busy || !form.email || !form.full_name} onClick={save}>{busy ? 'Oppretter…' : 'Opprett'}</Btn></div></>}</Modal>;
}
function EditAdminModal({ user, onClose, onDone }: any) {
  const [perms, setPerms] = useState<string[]>(user.permissions || []); const [disabled, setDisabled] = useState(!!user.disabled); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { setBusy(true); setErr(''); try { await api.updateAdminUser(user.id, { permissions: perms, disabled }); onDone(); } catch (e) { setErr(apiError(e)); setBusy(false); } };
  return <Modal title={'Tilganger · ' + (user.fullName || user.email)} onClose={onClose}><ErrorBanner msg={err} /><PermissionChecks selected={perms} onChange={setPerms} /><label className="permission-item danger-check"><input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} /><span>Deaktiver innlogging</span></label><div className="modal-actions"><Btn onClick={onClose}>Avbryt</Btn><Btn variant="primary" disabled={busy} onClick={save}>{busy ? 'Lagrer…' : 'Lagre'}</Btn></div></Modal>;
}
