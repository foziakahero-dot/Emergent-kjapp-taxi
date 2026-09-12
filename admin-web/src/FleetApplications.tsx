import React, { useEffect, useMemo, useState } from 'react';
import { api, apiError } from './api';
import { useAuth } from './auth';
import { Btn, Card, Drawer, Empty, ErrorBanner, KV, Loader, PageHead, Pill, fmtDate } from './ui';

const FIXED_COMMISSION = 0.12;

const DOC_LABELS: Record<string, string> = {
  firmaattest: 'Firmaattest',
  loyvebevis: 'Løyvebevis',
  vognkort: 'Vognkort',
  forsikring: 'Forsikringsbevis',
  bank: 'Bankkonto',
};

export default function FleetApplications() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending');
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';

  const load = async () => {
    if (!isSuperadmin) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api.fleetApplications(status);
      setApps(data?.applications || []);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isSuperadmin]);

  const openApplication = async (id: string) => {
    setDetailLoading(true);
    setErr('');
    try {
      const data = await api.fleetApplication(id);
      setSelected(data);
      setNotes(data?.review_notes || '');
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const close = () => {
    setSelected(null);
    setNotes('');
  };

  const approve = async () => {
    if (!selected?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api.approveFleetApplication(selected.id, notes);
      close();
      await load();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api.rejectFleetApplication(selected.id, notes);
      close();
      await load();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (doc: any) => {
    if (!doc?.path) return;
    try {
      const blob = await api.applicationFile(doc.path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErr(apiError(e));
    }
  };

  const counts = useMemo(() => ({
    total: apps.length,
  }), [apps]);

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
        sub="Dokumentkontroll og godkjenning før tilgang til fleet.kjappapp.no"
        right={<Btn variant="sm" onClick={load}>Oppdater</Btn>}
      />

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Venter på godkjenning</option>
          <option value="approved">Godkjente</option>
          <option value="rejected">Avslåtte</option>
        </select>
        <div className="dim" style={{ fontSize: 12 }}>{counts.total} søknader i visningen</div>
      </div>

      <ErrorBanner msg={err} />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Fast partnerprovisjon</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Nye godkjente løyvehavere opprettes med KJAPP-provisjon på 12 %.
            </div>
          </div>
          <div className="mono" style={{ fontSize: 26, color: 'var(--gold)', fontWeight: 700 }}>
            {Math.round(FIXED_COMMISSION * 100)}%
          </div>
        </div>
      </Card>

      <div className="section-title">Søknader</div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Bedrift</th>
              <th>Org.nr</th>
              <th>Kontakt</th>
              <th>Dokumenter</th>
              <th>Status</th>
              <th>Innsendt</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Loader /></td></tr>
            ) : apps.length ? apps.map((a: any) => (
              <tr key={a.id} className="click" onClick={() => openApplication(a.id)}>
                <td className="strong">{a.company_name || '—'}</td>
                <td className="mono dim">{a.org_number || '—'}</td>
                <td>
                  <div>{a.contact_name || '—'}</div>
                  <div className="cell-sub">{a.contact_email || ''}</div>
                </td>
                <td>{a.documents_count ?? Object.keys(a.documents || {}).length}/5</td>
                <td><Pill status={a.status} /></td>
                <td className="dim nowrap">{fmtDate(a.submitted_at || a.created_at)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6}><Empty title="Ingen søknader i denne statusen" /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detailLoading && <div className="center"><Loader /></div>}

      {selected && (
        <Drawer title={selected.company_name || 'Løyvehaversøknad'} onClose={close}>
          <div style={{ marginBottom: 14 }}><Pill status={selected.status} /></div>

          <Card>
            <KV k="Organisasjonsnummer" v={<span className="mono">{selected.org_number || '—'}</span>} />
            <KV k="Kontaktperson" v={selected.contact_name || '—'} />
            <KV k="E-post" v={selected.contact_email || '—'} />
            <KV k="Telefon" v={selected.contact_phone || '—'} />
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

          {selected.status === 'pending' ? (
            <>
              <div className="section-title">Superadmin beslutning</div>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>KJAPP-provisjon ved godkjenning</div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>Fast onboarding-sats</div>
                  </div>
                  <div className="mono" style={{ fontSize: 24, color: 'var(--gold)', fontWeight: 700 }}>12%</div>
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
                  <Btn disabled={busy} onClick={approve}>{busy ? 'Behandler…' : 'Godkjenn løyvehaver'}</Btn>
                  <Btn variant="ghost" disabled={busy} onClick={reject}>Avslå</Btn>
                </div>
              </Card>

              <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
                Ved godkjenning oppretter backend flåten og en fleet_owner-konto. Før dette har søkeren ingen tilgang til fleet.kjappapp.no.
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
        </Drawer>
      )}
    </>
  );
}