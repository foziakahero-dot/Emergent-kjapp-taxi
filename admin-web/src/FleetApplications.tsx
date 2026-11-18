import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiError } from './api';
import { useAuth } from './auth';
import { Btn, Card, Empty, ErrorBanner, KV, Loader, PageHead, Pill, fmtDate } from './ui';


const DOC_LABELS: Record<string, string> = {
  firmaattest: 'Firmaattest',
  loyvebevis: 'Løyvebevis',
  vognkort: 'Vognkort',
  forsikring: 'Forsikringsbevis',
  bank: 'Bankkonto',
};

type QueueState = { phase: 'loading' | 'error' | 'forbidden' } | { phase: 'ready'; apps: any[] };

export default function FleetApplications() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending');
  const [queue, setQueue] = useState<QueueState>({ phase: 'loading' });
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [approvalResult, setApprovalResult] = useState<any>(null);
  const [defaultCommission, setDefaultCommission] = useState<number | null>(null);
  const [commission, setCommission] = useState<number | null>(null);

  const isSuperadmin = user?.role === 'superadmin';
  useEffect(() => {
    if (!isSuperadmin) return;
    api.list('/admin/settings', {}).then((settings) => { const fee = Number(settings.default_commission) * 100; setDefaultCommission(fee); setCommission(fee); })
      .catch(() => setErr('Kunne ikke hente standard serviceavgift. Oppdater før godkjenning.'));
  }, [isSuperadmin]);

  const close = useCallback(() => {
    ++detailRequest.current;
    setApprovalResult(null);
    setSelected(null);
    setNotes('');
    setDetailLoading(false);
    setBusy(false);
    setErr('');
  }, []);

  const clearIfDenied = useCallback((e: any) => {
    if (e?.response?.status !== 401 && e?.response?.status !== 403) return false;
    ++listRequest.current;
    close();
    setQueue({ phase: 'forbidden' });
    return true;
  }, [close]);

  const load = useCallback(async (filter: string) => {
    const request = ++listRequest.current;
    setQueue({ phase: 'loading' });
    try {
      const data = await api.fleetApplications(filter);
      if (request !== listRequest.current) return;
      if (!Array.isArray(data?.applications) || !data.applications.every((a: any) => a?.id)) {
        setQueue({ phase: 'error' });
        return;
      }
      setQueue({ phase: 'ready', apps: data.applications });
    } catch (e) {
      if (request === listRequest.current && !clearIfDenied(e)) setQueue({ phase: 'error' });
    }
  }, [clearIfDenied]);

  useEffect(() => {
    if (isSuperadmin) void load('pending');
    return () => { ++listRequest.current; ++detailRequest.current; };
  }, [isSuperadmin, load]);

  const changeFilter = (filter: string) => {
    close();
    setStatus(filter);
    void load(filter);
  };

  const openApplication = async (id: string) => {
    close();
    const request = detailRequest.current;
    setCommission(defaultCommission);
    setDetailLoading(true);
    try {
      const data = await api.fleetApplication(id);
      if (request !== detailRequest.current) return;
      setSelected(data);
      setNotes(data?.review_notes || '');
    } catch (e) {
      if (request === detailRequest.current && !clearIfDenied(e)) setErr(apiError(e));
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  };

  const approve = async () => {
    if (!selected?.id) return;
    const request = detailRequest.current;
    setBusy(true);
    setErr('');
    try {
      if (commission == null || !Number.isFinite(commission) || commission < 0 || commission > 50) throw new Error('Oppgi serviceavgift mellom 0 og 50 %.');
      const result = await api.approveFleetApplication(selected.id, notes, commission / 100);
      if (request !== detailRequest.current) return;
      setApprovalResult(result);
      setSelected((value: any) => ({ ...value, status: 'approved', fleet_id: result.fleet_id, reviewed_at: new Date().toISOString() }));
      await load(status);
    } catch (e) {
      if (request === detailRequest.current && !clearIfDenied(e)) setErr(apiError(e));
    } finally {
      if (request === detailRequest.current) setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected?.id) return;
    const request = detailRequest.current;
    setBusy(true);
    setErr('');
    try {
      await api.rejectFleetApplication(selected.id, notes);
      if (request !== detailRequest.current) return;
      close();
      await load(status);
    } catch (e) {
      if (request === detailRequest.current && !clearIfDenied(e)) setErr(apiError(e));
    } finally {
      if (request === detailRequest.current) setBusy(false);
    }
  };

  const openDoc = async (doc: any) => {
    if (!doc?.path) return;
    const request = detailRequest.current;
    try {
      const blob = await api.applicationFile(doc.path);
      if (request !== detailRequest.current) return;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      if (request === detailRequest.current && !clearIfDenied(e)) setErr(apiError(e));
    }
  };

  const apps = queue.phase === 'ready' ? queue.apps : null;
  const refresh = () => { void load(status); };

  if (!isSuperadmin) {
    return (
      <>
        <PageHead title="Løyvehaversøknader" sub="Kun superadmin har tilgang" />
        <ErrorBanner msg="Denne siden er kun tilgjengelig for superadmin." />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Løyvehaversøknader"
        sub="Dokumentkontroll og godkjenning før tilgang til SNAR Fleet"
        right={<Btn variant="sm" onClick={refresh}>Oppdater</Btn>}
      />

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <select className="select" aria-label="Søknadsstatus" value={status} onChange={(e) => changeFilter(e.target.value)}>
          <option value="pending">Venter på godkjenning</option>
          <option value="approved">Godkjente</option>
          <option value="rejected">Avslåtte</option>
        </select>
        {apps && <div className="dim" style={{ fontSize: 12 }}>{apps.length} søknad{apps.length === 1 ? '' : 'er'} i visningen</div>}
      </div>

      <ErrorBanner msg={err} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Avtalt serviceavgift</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Standard hentes fra Prissetting. Du kan velge en egen avtalt sats ved godkjenning.
            </div>
          </div>
          <div className="mono" style={{ fontSize: 26, color: 'var(--gold)', fontWeight: 700 }}>
            {defaultCommission == null ? '—' : `${defaultCommission}%`}
          </div>
        </div>
      </Card>

      <div className="app-layout" style={{marginTop:20}}>
        <section className="card app-list" aria-busy={queue.phase === 'loading'}><div className="card-head"><h2 className="card-title">Søknader{apps && ` (${apps.length})`}</h2></div>
          {queue.phase === 'loading' ? <div role="status" aria-label="Henter søknader"><Loader/></div> : !apps ? <div>
            <div role="alert" className="error-banner">{queue.phase === 'forbidden' ? 'Du har ikke tilgang til å se søknadene.' : 'Kunne ikke hente søknadene. Antallet er ukjent.'}</div>
            <Btn onClick={refresh}>Prøv igjen</Btn>
          </div> : apps.length ? apps.map((a:any) => <button key={a.id} className={`application-row ${selected?.id === a.id ? 'selected' : ''}`} onClick={() => openApplication(a.id)}><strong>{a.company_name || 'Ukjent bedrift'}</strong><span className="application-meta">{a.org_number || '—'} · {a.contact_name || '—'}</span><span className="application-meta">{fmtDate(a.submitted_at || a.created_at)} · {a.documents_count ?? Object.keys(a.documents || {}).length}/5 dokumenter</span><Pill status={a.status}/></button>) : <Empty title="Ingen søknader i denne statusen"/>}
        </section>
        <section className="card app-detail" aria-busy={detailLoading}>
          {detailLoading ? <Loader/> : !selected ? <Empty title="Velg en søknad" sub="Kontroller dokumentene før godkjenning eller avslag."/> : <>
          <div className="app-detail-head"><h2 className="card-title">{selected.company_name || 'Løyvehaversøknad'}</h2><Btn variant="ghost sm" onClick={close}>Lukk</Btn></div>
          <div style={{ marginBottom: 14 }}><Pill status={selected.status} /></div>

          <Card>
            <KV k="Organisasjonsnummer" v={<span className="mono">{selected.org_number || '—'}</span>} />
            <KV k="Kontaktperson" v={selected.contact_name || '—'} />
            <KV k="E-post" v={selected.contact_email || '—'} />
            <KV k="Telefon" v={selected.contact_phone || '—'} />
            <KV k="Antall løyver" v={selected.license_count ?? '—'} />
            <KV k="Antall biler" v={selected.vehicle_count ?? '—'} />
            <KV k="Bankkonto" v={selected.bank_account || '—'} />
          </Card>

          <div className="section-title">Dokumentasjon</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(DOC_LABELS).map(([key, label]) => {
              const doc = selected.documents?.[key];
              return (
                <button
                  key={key}
                  className="btn ghost"
                  disabled={!doc}
                  onClick={() => doc && openDoc(doc)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                >
                  <span>{label}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{doc?.original_filename || 'Mangler'}</span>
                </button>
              );
            })}
          </div>

          {selected.notes ? (
            <>
              <div className="section-title">Notat fra søker</div>
              <Card><div style={{ fontSize: 13, lineHeight: 1.55 }}>{selected.notes}</div></Card>
            </>
          ) : null}

          {approvalResult ? <Card>
            <div className="section-title">Flåten er opprettet</div>
            <p>{approvalResult.confirmation_email_status === 'queued' ? 'Bekreftelsen er lagt i e-postkøen.' : 'E-post er ikke konfigurert. Bekreftelsen ligger i kø til tjenesten aktiveres.'}</p>
            <p>Løyvehaveren logger inn på <a href={(import.meta as any).env.VITE_FLEET_URL || 'https://fleet.snarapp.no/login'} target="_blank" rel="noreferrer">SNAR Fleet</a> med e-postadressen fra søknaden.</p>
            {approvalResult.temp_password ? <><p>Midlertidig passord vises bare nå. Løyvehaveren bør velge et nytt passord via engangslenken i bekreftelsesmailen.</p><input className="input" aria-label="Midlertidig passord til ny løyvehaver" type="password" value={approvalResult.temp_password} readOnly autoComplete="off"/><Btn variant="ghost" onClick={() => void navigator.clipboard?.writeText(approvalResult.temp_password)}>Kopier midlertidig passord</Btn></> : <p>Bruk eksisterende passord, eller velg Glemt passord når e-post er aktivert.</p>}
          </Card> : null}

          {selected.status === 'pending' ? (
            <>
              <div className="section-title">Superadmin beslutning</div>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>SNAR-provisjon ved godkjenning</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>Avtalt sats for denne løyvehaveren</div>
                  </div>
                  <label>Serviceavgift (%)<input className="input" aria-label="Serviceavgift ved godkjenning" type="number" min="0" max="50" step="0.1" value={commission ?? ''} onChange={(e) => setCommission(e.target.value === '' ? null : Number(e.target.value))}/></label>
                </div>

                <textarea
                  className="input"
                  rows={4}
                  placeholder="Notat til søker (valgfritt)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical', marginBottom: 12 }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Btn disabled={busy || commission == null} onClick={approve}>{busy ? 'Behandler…' : 'Godkjenn løyvehaver'}</Btn>
                  <Btn variant="ghost" disabled={busy} onClick={reject}>Avslå</Btn>
                </div>
              </Card>

              <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                Godkjenning åpner søkerens egen flåte i SNAR Fleet. Søkeren fullfører Stripe-verifisering i portalen før utbetalinger kan starte.
              </div>
            </>
          ) : (
            <>
              <div className="section-title">Beslutning</div>
              <Card>
                <KV k="Status" v={<Pill status={selected.status} />} />
                <KV k="Behandlet" v={fmtDate(selected.reviewed_at)} />
                <KV k="Fleet ID" v={<span className="mono">{selected.fleet_id || '—'}</span>} />
                {selected.review_notes ? <KV k="Notat" v={selected.review_notes} /> : null}
              </Card>
            </>
          )}
          </>}
        </section>
      </div>
    </>
  );
}

