import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { api, apiError } from './api';
import { Btn, Card, Empty, ErrorBanner, Loader, PageHead, Pill, fmtDate, useAsync } from './ui';

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
};

const row: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const sectionStyle: React.CSSProperties = { marginBottom: 18 };

const FEATURE_LABELS: Record<string, string> = {
  booking_enabled: 'Bestilling aktiv',
  surge: 'Dynamisk prising',
  ai_chat: 'KJAPP Assist',
  vipps: 'Vipps',
  demo_trips: 'Demo-turer (låst av)',
};
const QUICK_FEATURES = new Set(['booking_enabled', 'ai_chat']);

function Toggle({ checked, disabled, onChange, label, sub }: any) {
  return <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', opacity: disabled ? .55 : 1 }}>
    <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
    <span><span className="strong">{label}</span>{sub ? <span className="cell-sub" style={{ display: 'block' }}>{sub}</span> : null}</span>
  </label>;
}

function Field({ label, value, onChange, placeholder = '', disabled = false }: any) {
  return <div className="field">
    <label className="label">{label}</label>
    <input className="input" value={value ?? ''} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} />
  </div>;
}

function TextArea({ label, value, onChange, placeholder = '', disabled = false }: any) {
  return <div className="field">
    <label className="label">{label}</label>
    <textarea className="textarea" value={value ?? ''} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} />
  </div>;
}

function ConfigEditor() {
  const { user } = useAuth();
  const isSuper = user?.role === 'superadmin';
  const state = useAsync(() => api.runtimeConfig(), []);
  const history = useAsync(() => api.runtimeConfigHistory(), []);
  const [runtime, setRuntime] = useState<any>(null);
  const [features, setFeatures] = useState<any>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!state.data) return;
    setRuntime(JSON.parse(JSON.stringify(state.data.runtime_config || {})));
    setFeatures({ ...(state.data.features || {}) });
  }, [state.data]);

  const update = (section: string, key: string, value: any) => {
    setRuntime((old: any) => ({ ...old, [section]: { ...(old?.[section] || {}), [key]: value } }));
  };

  const save = async () => {
    if (!reason.trim()) { setErr('Skriv hvorfor endringen gjøres.'); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const result = await api.patchRuntimeConfig({
        runtime_patch: runtime,
        feature_patch: {
          booking_enabled: !!features.booking_enabled,
          ai_chat: !!features.ai_chat,
        },
        reason: reason.trim(),
      });
      setMsg('Publisert som konfigurasjonsversjon ' + result.version + '.');
      setReason('');
      state.reload(); history.reload();
    } catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  };

  const rollback = async (version: number) => {
    const why = window.prompt('Begrunn rollback til v' + version + ':');
    if (!why || why.trim().length < 3) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const result = await api.rollbackRuntimeConfig(version, why.trim());
      setMsg('Rollback publisert som ny versjon ' + result.version + '.');
      state.reload(); history.reload();
    } catch (e) { setErr(apiError(e)); }
    finally { setBusy(false); }
  };

  if (state.loading || !runtime) return <Loader />;

  return <>
    <ErrorBanner msg={state.err || err} />
    {msg && <div className="ok-banner" style={sectionStyle}>{msg}</div>}
    <div style={grid2}>
      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Kundeapp · live config</div>
        <Field label="Hovedtekst" value={runtime.customer?.home_prompt} disabled={!isSuper}
          onChange={(v: string) => update('customer', 'home_prompt', v)} />
        <Field label="Hjelpetekst" value={runtime.customer?.home_hint} disabled={!isSuper}
          onChange={(v: string) => update('customer', 'home_hint', v)} />
        <Toggle label="Vedlikeholdsmodus" checked={runtime.customer?.maintenance_mode} disabled={!isSuper}
          onChange={(v: boolean) => update('customer', 'maintenance_mode', v)} />
        <TextArea label="Vedlikeholdsmelding" value={runtime.customer?.maintenance_message} disabled={!isSuper}
          onChange={(v: string) => update('customer', 'maintenance_message', v)} />
        <Toggle label="Tving appoppdatering" checked={runtime.customer?.force_update} disabled={!isSuper}
          onChange={(v: boolean) => update('customer', 'force_update', v)} />
        <Field label="Min. støttet versjon" value={runtime.customer?.min_supported_version} disabled={!isSuper}
          placeholder="f.eks. 1.0.3" onChange={(v: string) => update('customer', 'min_supported_version', v)} />
      </Card>

      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Sjåførapp · live config</div>
        <Toggle label="Vedlikeholdsmodus" checked={runtime.driver?.maintenance_mode} disabled={!isSuper}
          onChange={(v: boolean) => update('driver', 'maintenance_mode', v)} />
        <TextArea label="Vedlikeholdsmelding" value={runtime.driver?.maintenance_message} disabled={!isSuper}
          onChange={(v: string) => update('driver', 'maintenance_message', v)} />
        <Toggle label="Tving appoppdatering" checked={runtime.driver?.force_update} disabled={!isSuper}
          onChange={(v: boolean) => update('driver', 'force_update', v)} />
        <Field label="Min. støttet versjon" value={runtime.driver?.min_supported_version} disabled={!isSuper}
          placeholder="f.eks. 1.0.3" onChange={(v: string) => update('driver', 'min_supported_version', v)} />
        <div className="section-title">Felles support</div>
        <Field label="Support e-post" value={runtime.shared?.support_email} disabled={!isSuper}
          onChange={(v: string) => update('shared', 'support_email', v)} />
        <Field label="Support telefon" value={runtime.shared?.support_phone} disabled={!isSuper}
          onChange={(v: string) => update('shared', 'support_phone', v)} />
        <Field label="Hjelpeside" value={runtime.shared?.help_url} disabled={!isSuper}
          onChange={(v: string) => update('shared', 'help_url', v)} />
        <TextArea label="Global statusmelding" value={runtime.shared?.status_message} disabled={!isSuper}
          onChange={(v: string) => update('shared', 'status_message', v)} />
      </Card>

      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Feature flags</div>
        {Object.keys(features).sort().map((key) =>
          <Toggle key={key} label={FEATURE_LABELS[key] || key} checked={features[key]}
            disabled={!isSuper || !QUICK_FEATURES.has(key)}
            sub={
              key === 'demo_trips' ? 'Permanent av i beta/produksjon.' :
              QUICK_FEATURES.has(key) ? 'Serverstyrt. Ingen ny APK nødvendig.' :
              'Endres i dedikert Settings/Pricing — ikke via hurtigpublisering.'
            }
            onChange={(v: boolean) => setFeatures((old: any) => ({ ...old, [key]: v }))} />
        )}
      </Card>

      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Publisering</div>
        <div className="cell-sub" style={{ marginBottom: 12 }}>
          Nåværende versjon: <span className="mono">v{state.data?.version ?? 1}</span> · sist endret {fmtDate(state.data?.updated_at)}
        </div>
        <TextArea label="Hvorfor gjør du endringen?" value={reason} disabled={!isSuper}
          placeholder="F.eks. Endrer supportadresse før offentlig beta" onChange={setReason} />
        <Btn variant="primary" disabled={!isSuper || busy || !reason.trim()} onClick={save}>
          {busy ? 'Publiserer…' : 'Publiser live config'}
        </Btn>
        {!isSuper && <div className="cell-sub" style={{ marginTop: 10 }}>Kun superadmin kan publisere eller rulle tilbake.</div>}
      </Card>
    </div>

    <div className="section-title">Versjonshistorikk & rollback</div>
    {history.loading ? <Loader /> : <div className="tablewrap"><table>
      <thead><tr><th>Versjon</th><th>Tid</th><th>Kilde</th><th>Begrunnelse</th><th>Av</th><th className="right">Handling</th></tr></thead>
      <tbody>
        {(history.data?.versions || []).map((v: any) => <tr key={v.version}>
          <td className="mono">v{v.version}</td><td>{fmtDate(v.saved_at)}</td><td>{v.source}</td>
          <td>{v.reason || '—'}</td><td>{v.saved_by || '—'}</td>
          <td className="right">{isSuper && v.version !== state.data?.version ? <Btn variant="sm" disabled={busy} onClick={() => rollback(v.version)}>Rollback</Btn> : null}</td>
        </tr>)}
        {!history.data?.versions?.length && <tr><td colSpan={6}><Empty title="Ingen tidligere versjoner ennå" /></td></tr>}
      </tbody>
    </table></div>}
  </>;
}

function ReleaseCenter() {
  const { user } = useAuth();
  const isSuper = user?.role === 'superadmin';
  const state = useAsync(() => api.releases(), []);
  const [form, setForm] = useState<any>({ app: 'customer', kind: 'ota', channel: 'staging', version: '1.0.0', source_ref: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const create = async () => {
    setBusy(true); setErr(''); setMsg('');
    try { await api.createRelease(form); setMsg('Release-plan opprettet.'); state.reload(); }
    catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const transition = async (id: string, status: string) => {
    const note = window.prompt('Notat (valgfritt):') || '';
    setBusy(true); setErr(''); setMsg('');
    try { await api.transitionRelease(id, status, note); state.reload(); }
    catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const nextAction = (r: any) => {
    if (r.status === 'planned') return ['approved', 'Godkjenn'];
    if (r.status === 'approved') return ['publishing', 'Start publisering'];
    if (r.status === 'publishing') return ['published', 'Marker publisert'];
    if (r.status === 'published') return ['rolled_back', 'Rollback'];
    if (r.status === 'failed') return ['planned', 'Prøv igjen'];
    return null;
  };

  return <>
    <ErrorBanner msg={err || state.err} />{msg && <div className="ok-banner" style={sectionStyle}>{msg}</div>}
    <div style={grid2}>
      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Ny release</div>
        <div className="cell-sub" style={{ marginBottom: 12 }}>
          Remote config = uten build · OTA = JS/UI · Native = ny App Store/Play-build.
        </div>
        <div style={grid2}>
          <div className="field"><label className="label">App</label><select className="select" value={form.app} disabled={!isSuper} onChange={e => setForm({ ...form, app: e.target.value })}>
            <option value="customer">Kunde</option><option value="driver">Sjåfør</option><option value="admin">Admin</option><option value="fleet">Fleet</option><option value="backend">Backend</option><option value="all">Alle</option>
          </select></div>
          <div className="field"><label className="label">Type</label><select className="select" value={form.kind} disabled={!isSuper} onChange={e => setForm({ ...form, kind: e.target.value })}>
            <option value="config">Config</option><option value="ota">OTA</option><option value="native">Native build</option><option value="backend">Backend</option><option value="web">Web</option>
          </select></div>
          <div className="field"><label className="label">Kanal</label><select className="select" value={form.channel} disabled={!isSuper} onChange={e => setForm({ ...form, channel: e.target.value })}>
            <option value="staging">Staging</option><option value="production">Production</option>
          </select></div>
          <Field label="Versjon / navn" value={form.version} disabled={!isSuper} onChange={(v: string) => setForm({ ...form, version: v })} />
        </div>
        <Field label="Git SHA / source ref" value={form.source_ref} disabled={!isSuper} onChange={(v: string) => setForm({ ...form, source_ref: v })} />
        <TextArea label="Notat" value={form.notes} disabled={!isSuper} onChange={(v: string) => setForm({ ...form, notes: v })} />
        <Btn variant="primary" disabled={!isSuper || busy || !form.version} onClick={create}>Opprett release-plan</Btn>
      </Card>

      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Automatisering</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={row}><Pill status="completed" label="Remote config" /><span className="cell-sub">Publiseres direkte med audit + rollback.</span></div>
          <div style={row}><Pill status="pending" label="OTA" /><span className="cell-sub">GitHub/EAS Update workflow. Krever godkjent production-channel.</span></div>
          <div style={row}><Pill status="pending" label="Native" /><span className="cell-sub">EAS Build + TestFlight/Play. Kan ikke OTA-oppdateres.</span></div>
          <div style={row}><Pill status="completed" label="Approval gate" /><span className="cell-sub">Produksjonsendringer krever eksplisitt godkjenning.</span></div>
        </div>
      </Card>
    </div>

    <div className="section-title">Releasehistorikk</div>
    {state.loading ? <Loader /> : <div className="tablewrap"><table>
      <thead><tr><th>Opprettet</th><th>App</th><th>Type</th><th>Kanal</th><th>Versjon</th><th>Status</th><th>Source</th><th className="right">Handling</th></tr></thead>
      <tbody>{(state.data?.releases || []).map((r: any) => {
        const next = nextAction(r);
        return <tr key={r.id}><td>{fmtDate(r.created_at)}</td><td>{r.app}</td><td>{r.kind}</td><td>{r.channel}</td>
          <td className="mono">{r.version}</td><td><Pill status={r.status === 'published' ? 'completed' : r.status === 'failed' ? 'failed' : 'pending'} label={r.status} /></td>
          <td className="mono">{r.source_ref || '—'}</td>
          <td className="right">{isSuper && next ? <Btn variant="sm" disabled={busy} onClick={() => transition(r.id, next[0])}>{next[1]}</Btn> : null}</td>
        </tr>;
      })}
      {!state.data?.releases?.length && <tr><td colSpan={8}><Empty title="Ingen releaser registrert ennå" /></td></tr>}
      </tbody>
    </table></div>}
  </>;
}

function AIEngineer() {
  const { user } = useAuth();
  const isSuper = user?.role === 'superadmin';
  const plans = useAsync(() => api.aiPlans(), []);
  const [request, setRequest] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const plan = async () => {
    setBusy(true); setErr(''); setMsg('');
    try { const result = await api.aiPlan(request); setCurrent(result); plans.reload(); }
    catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const approve = async (id: string) => {
    const note = window.prompt('Godkjenningsnotat (valgfritt):') || '';
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.approveAIPlan(id, note); setMsg('Plan godkjent. Ingen produksjonsendring er gjort ennå.');
      const refreshed = await api.aiPlans(); setCurrent(refreshed.plans?.find((p: any) => p.id === id) || current); plans.reload();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const apply = async (id: string) => {
    if (!window.confirm('Publiser denne allow-listede konfigurasjonsendringen nå?')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const result = await api.applyAIPlan(id);
      setMsg('Publisert som runtime config v' + result.version + '.');
      plans.reload();
      setCurrent((x: any) => x ? { ...x, status: 'applied', applied_version: result.version } : x);
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return <>
    <ErrorBanner msg={err || plans.err} />{msg && <div className="ok-banner" style={sectionStyle}>{msg}</div>}
    <div style={grid2}>
      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>KJAPP AI Senior Engineer</div>
        <div className="cell-sub" style={{ marginBottom: 12 }}>
          Beskriv endringen med vanlig norsk. AI lager plan og risikovurdering. Den får aldri kjøre vilkårlig kode direkte i produksjon.
        </div>
        <TextArea label="Hva vil du endre?" value={request} onChange={setRequest}
          placeholder={'Eksempel: Endre teksten "Hvor skal du?" til "Hvor går turen?"'} />
        <Btn variant="primary" disabled={busy || request.trim().length < 3} onClick={plan}>
          {busy ? 'Analyserer…' : 'Lag endringsplan'}
        </Btn>
        <div className="cell-sub" style={{ marginTop: 12 }}>
          AI-provider: {plans.data?.ai_configured ? 'OpenAI konfigurert' : 'Safe rules fallback (OPENAI_API_KEY ikke satt)'}
        </div>
      </Card>

      <Card>
        <div className="section-title" style={{ marginTop: 0 }}>Godkjenningsgate</div>
        {!current ? <Empty title="Ingen aktiv plan" sub="Lag en plan først." /> : <>
          <div style={row}><Pill status={current.risk === 'high' ? 'failed' : current.risk === 'low' ? 'completed' : 'pending'} label={'Risk: ' + current.risk} />
            <Pill status="gray" label={current.change_type} /><Pill status="gray" label={current.status} /></div>
          <div className="strong" style={{ marginTop: 14 }}>{current.summary}</div>
          {current.notes?.map((n: string, i: number) => <div className="cell-sub" key={i} style={{ marginTop: 6 }}>• {n}</div>)}
          {(Object.keys(current.runtime_patch || {}).length || Object.keys(current.feature_patch || {}).length) ? <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 12, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
            {JSON.stringify({ runtime_patch: current.runtime_patch, feature_patch: current.feature_patch }, null, 2)}
          </pre> : null}
          <div style={{ ...row, marginTop: 14 }}>
            {isSuper && current.status === 'proposed' && <Btn onClick={() => approve(current.id)} disabled={busy}>Godkjenn plan</Btn>}
            {isSuper && current.status === 'approved' && current.change_type === 'config' && <Btn variant="primary" onClick={() => apply(current.id)} disabled={busy}>Publiser config</Btn>}
          </div>
          {current.change_type !== 'config' && <div className="cell-sub" style={{ marginTop: 12 }}>
            Denne planen må gjennom GitHub/release-pipeline. Admin kan ikke skrive kode direkte til produksjon.
          </div>}
        </>}
      </Card>
    </div>

    <div className="section-title">Tidligere AI-planer</div>
    {plans.loading ? <Loader /> : <div className="tablewrap"><table>
      <thead><tr><th>Tid</th><th>Forespørsel</th><th>Type</th><th>Risiko</th><th>Status</th><th>Provider</th><th className="right">Åpne</th></tr></thead>
      <tbody>{(plans.data?.plans || []).map((p: any) => <tr key={p.id}>
        <td>{fmtDate(p.created_at)}</td><td><div className="strong">{String(p.request || '').slice(0, 100)}</div><div className="cell-sub">{p.summary}</div></td>
        <td>{p.change_type}</td><td>{p.risk}</td><td><Pill status={p.status === 'applied' ? 'completed' : 'pending'} label={p.status} /></td>
        <td>{p.provider}</td><td className="right"><Btn variant="sm" onClick={() => setCurrent(p)}>Åpne</Btn></td>
      </tr>)}
      {!plans.data?.plans?.length && <tr><td colSpan={7}><Empty title="Ingen AI-planer ennå" /></td></tr>}
      </tbody>
    </table></div>}
  </>;
}

export default function OperationsOS() {
  const [tab, setTab] = useState<'config' | 'releases' | 'ai'>('config');
  const tabs = useMemo(() => [
    ['config', 'Remote Config'],
    ['releases', 'Release Center'],
    ['ai', 'AI Engineer'],
  ] as const, []);

  return <>
    <PageHead title="KJAPP Operations OS" sub="Endre små ting raskt, kontrollert og med rollback — uten unødvendige builds." />
    <div style={{ ...row, marginBottom: 18 }}>
      {tabs.map(([id, label]) => <Btn key={id} variant={tab === id ? 'primary' : ''} onClick={() => setTab(id)}>{label}</Btn>)}
    </div>
    {tab === 'config' ? <ConfigEditor /> : tab === 'releases' ? <ReleaseCenter /> : <AIEngineer />}
  </>;
}
