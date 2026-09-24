import React, { useEffect, useMemo, useState } from 'react';
import { api, apiError } from './api';
import { Btn, Empty, ErrorBanner, Loader, PageHead, Pagination, Pill, fmtDate } from './ui';

type Verification = {
  id: string;
  status: string;
  submitted_at?: string;
  reviewed_at?: string;
  review_reason?: string;
  selfie_storage_path?: string;
  driver_id: string;
  driver_name?: string;
  driver_email?: string;
  fleet_id?: string;
  car?: string;
  plate?: string;
  profile_photo_path?: string;
  drivers_license_path?: string;
  taxi_license_path?: string;
};

const statusLabel = (status?: string) => ({
  pending_review: 'Til kontroll',
  verified: 'Verifisert',
  retry_required: 'Ny selfie kreves',
  superseded: 'Erstattet',
}[status || ''] || status || 'Ukjent');

const statusPill = (status?: string) => {
  if (status === 'verified') return <Pill status="VALID" label="Verifisert" />;
  if (status === 'retry_required') return <Pill status="REJECTED" label="Ny selfie" />;
  if (status === 'superseded') return <Pill status="gray" label="Erstattet" />;
  return <Pill status="pending" label="Til kontroll" />;
};

export default function IdentityVerifications() {
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<Verification | null>(null);

  const load = async () => {
    setLoading(true); setErr('');
    try { setData(await api.identityVerifications(status, page, 50)); }
    catch (e) { setErr(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [status, page]);

  const rows: Verification[] = useMemo(
    () => data?.items || data?.verifications || [],
    [data],
  );

  const openFile = async (path?: string) => {
    if (!path) return;
    const popup = window.open('', '_blank');
    try {
      const blob = await api.secureFile(path);
      const url = URL.createObjectURL(blob);
      if (popup) popup.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (popup) popup.close();
      setErr(apiError(e));
    }
  };

  const review = async (v: Verification, next: 'verified' | 'retry_required') => {
    let reason = '';
    if (next === 'retry_required') {
      reason = window.prompt('Hva må sjåføren rette før ny selfie?', '') || '';
      if (!reason.trim()) return;
      if (!window.confirm('Be sjåføren ta en ny selfie?')) return;
    } else if (!window.confirm(`Bekreft at identiteten til ${v.driver_name || 'sjåføren'} er kontrollert manuelt?`)) {
      return;
    }
    setBusy(v.id); setErr('');
    try {
      await api.reviewIdentityVerification(v.id, next, reason.trim() || undefined);
      setSelected(null);
      await load();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHead
        title="Selfie ID"
        sub="Manuell identitetskontroll av KJAPP-sjåfører"
        right={<Btn variant="sm" onClick={() => void load()}>Oppdater</Btn>}
      />

      <div className="info-banner">
        Sammenlign fersk selfie med sjåførens eksisterende profilfoto og ID-dokumenter.
        Systemet tar ikke en automatisk negativ beslutning basert på ansiktsmatching.
      </div>

      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="pending_review">Til kontroll</option>
          <option value="verified">Verifisert</option>
          <option value="retry_required">Ny selfie kreves</option>
          <option value="all">Alle</option>
        </select>
      </div>

      <ErrorBanner msg={err} />

      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Sjåfør</th><th>Kjøretøy</th><th>Status</th><th>Sendt inn</th><th>Dokumenter</th><th className="right">Kontroll</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><Loader /></td></tr> : rows.length ? rows.map((v) => (
              <tr key={v.id} className="click" onClick={() => setSelected(v)}>
                <td><div className="strong">{v.driver_name || 'Sjåfør'}</div><div className="cell-sub">{v.driver_email || '—'}</div></td>
                <td>{v.car || '—'} <span className="mono dim">{v.plate || ''}</span></td>
                <td>{statusPill(v.status)}</td>
                <td className="dim nowrap">{fmtDate(v.submitted_at)}</td>
                <td>
                  <div className="inline-actions">
                    <Btn variant="sm" onClick={(e: any) => { e.stopPropagation(); void openFile(v.selfie_storage_path); }}>Selfie</Btn>
                    {v.profile_photo_path ? <Btn variant="sm" onClick={(e: any) => { e.stopPropagation(); void openFile(v.profile_photo_path); }}>Profilfoto</Btn> : null}
                    {v.drivers_license_path ? <Btn variant="sm" onClick={(e: any) => { e.stopPropagation(); void openFile(v.drivers_license_path); }}>Førerkort</Btn> : null}
                  </div>
                </td>
                <td className="right">{v.status === 'pending_review' ? <span className="dim">Åpne saken →</span> : statusLabel(v.status)}</td>
              </tr>
            )) : <tr><td colSpan={6}><Empty title="Ingen selfie-kontroller i valgt status" /></td></tr>}
          </tbody>
        </table>
        <Pagination
          page={data?.page || page}
          totalPages={data?.total_pages || 1}
          total={data?.total || rows.length}
          onPage={setPage}
        />
      </div>

      {selected ? (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.driver_name || 'Sjåfør'}</div>
                <div className="cell-sub">{selected.driver_email || ''}</div>
              </div>
              <button className="x" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div style={{ marginBottom: 16 }}>{statusPill(selected.status)}</div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title" style={{ marginTop: 0 }}>Vis dokumenter</div>
                <div className="fleet-actions">
                  <Btn onClick={() => void openFile(selected.selfie_storage_path)}>Åpne fersk selfie</Btn>
                  {selected.profile_photo_path ? <Btn onClick={() => void openFile(selected.profile_photo_path)}>Profilfoto</Btn> : null}
                  {selected.drivers_license_path ? <Btn onClick={() => void openFile(selected.drivers_license_path)}>Førerkort</Btn> : null}
                  {selected.taxi_license_path ? <Btn onClick={() => void openFile(selected.taxi_license_path)}>Kjøreseddel</Btn> : null}
                </div>
              </div>

              <div className="kv"><div className="k">Bil</div><div className="v">{selected.car || '—'} {selected.plate || ''}</div></div>
              <div className="kv"><div className="k">Sendt inn</div><div className="v">{fmtDate(selected.submitted_at)}</div></div>
              <div className="kv"><div className="k">Sist vurdert</div><div className="v">{fmtDate(selected.reviewed_at)}</div></div>
              {selected.review_reason ? <div className="error-banner" style={{ marginTop: 14 }}>{selected.review_reason}</div> : null}

              {selected.status === 'pending_review' ? (
                <>
                  <div className="section-title">Manuell beslutning</div>
                  <div className="info-banner">
                    Godkjenn bare når du har kontrollert at selfien og eksisterende ID-/profilmateriale tilhører samme sjåfør.
                  </div>
                  <div className="fleet-actions">
                    <Btn variant="primary" disabled={busy === selected.id} onClick={() => void review(selected, 'verified')}>Godkjenn identitet</Btn>
                    <Btn variant="danger" disabled={busy === selected.id} onClick={() => void review(selected, 'retry_required')}>Be om ny selfie</Btn>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
