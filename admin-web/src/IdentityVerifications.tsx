import React, { useEffect, useMemo, useState } from 'react';
import { api, apiError } from './api';
import { Btn, Empty, ErrorBanner, Loader, PageHead, Pagination, Pill, fmtDate } from './ui';
import { useAuth } from './auth';

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
  driver_identity_status?: string;
  identity_verified_at?: string;
  next_identity_check_at?: string;
  identity_recheck_reason?: string;
  identity_recheck_trigger?: string;
  identity_recheck_deferred?: boolean;
};

const statusLabel = (status?: string) => ({
  pending_review: 'Til kontroll',
  verified: 'Verifisert',
  retry_required: 'Ny selfie kreves',
  recheck_required: 'Ny kontroll kreves',
  superseded: 'Erstattet',
}[status || ''] || status || 'Ukjent');

const statusPill = (status?: string) => {
  if (status === 'verified') return <Pill status="VALID" label="Verifisert" />;
  if (status === 'retry_required') return <Pill status="REJECTED" label="Ny selfie" />;
  if (status === 'recheck_required') return <Pill status="REJECTED" label="Ny kontroll" />;
  if (status === 'superseded') return <Pill status="gray" label="Erstattet" />;
  return <Pill status="pending" label="Til kontroll" />;
};

export default function IdentityVerifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<Verification | null>(null);
  const [retention, setRetention] = useState<any>(null);
  const [retentionBusy, setRetentionBusy] = useState('');
  const [retentionMsg, setRetentionMsg] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try { setData(await api.identityVerifications(status, page, 50)); }
    catch (e) { setErr(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [status, page]);

  const loadRetention = async () => {
    if (user?.role !== 'superadmin') return;
    try { setRetention(await api.identityRetention()); }
    catch (e) { setErr(apiError(e)); }
  };

  useEffect(() => { void loadRetention(); }, [user?.role]);

  const retentionDryRun = async () => {
    setRetentionBusy('dry'); setRetentionMsg(''); setErr('');
    try {
      const result = await api.purgeExpiredIdentitySelfies(true, 100);
      setRetentionMsg(`Dry-run: ${result.eligible || 0} selfie(r) er klare for sletting. Ingen filer ble slettet.`);
      await loadRetention();
    } catch (e) { setErr(apiError(e)); }
    finally { setRetentionBusy(''); }
  };

  const retentionPurge = async () => {
    const eligible = Number(retention?.eligible_for_purge || 0);
    if (!eligible) { setRetentionMsg('Ingen selfies er klare for sletting.'); return; }
    if (!window.confirm(`Slett fysisk opptil ${eligible} utløpte identitetsselfies fra objektlageret? Dette kan ikke angres.`)) return;
    setRetentionBusy('purge'); setRetentionMsg(''); setErr('');
    try {
      const result = await api.purgeExpiredIdentitySelfies(false, 100);
      const failed = result.failed?.length || 0;
      setRetentionMsg(`Slettet ${result.purged?.length || 0} selfie(r)${failed ? `; ${failed} feilet og ble beholdt` : ''}.`);
      await loadRetention();
      await load();
    } catch (e) { setErr(apiError(e)); }
    finally { setRetentionBusy(''); }
  };

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

  const requestRecheck = async (v: Verification) => {
    const reason = window.prompt('Hvorfor skal sjåføren ta ny Selfie ID?', 'Periodisk sikkerhetskontroll') || '';
    if (reason.trim().length < 3) return;
    if (!window.confirm(`Kreve ny Selfie ID fra ${v.driver_name || 'sjåføren'}?`)) return;
    setBusy(`recheck-${v.driver_id}`); setErr('');
    try {
      const result = await api.requestIdentityRecheck(v.driver_id, reason.trim());
      setSelected(null);
      await load();
      if (result?.deferred) {
        window.alert('Kontrollen er registrert og aktiveres etter sjåførens pågående tur.');
      }
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

      {user?.role === 'superadmin' ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="section-title" style={{ marginTop: 0 }}>Selfie-retention</div>
          <div className="info-banner">
            Rå identitetsselfies beholdes i {retention?.retention_days ?? 30} dager etter terminal behandling.
            Ventende saker slettes aldri av denne jobben.
          </div>
          <div className="kv"><div className="k">Klar for sletting</div><div className="v">{retention?.eligible_for_purge ?? '—'}</div></div>
          <div className="kv"><div className="k">Terminale, fortsatt beholdt</div><div className="v">{retention?.retained_terminal ?? '—'}</div></div>
          <div className="kv"><div className="k">Ventende, ekskludert</div><div className="v">{retention?.pending_review_excluded ?? '—'}</div></div>
          <div className="fleet-actions" style={{ marginTop: 14 }}>
            <Btn variant="sm" disabled={Boolean(retentionBusy)} onClick={() => void retentionDryRun()}>
              {retentionBusy === 'dry' ? 'Kontrollerer…' : 'Kjør dry-run'}
            </Btn>
            <Btn variant="danger" disabled={Boolean(retentionBusy) || !(retention?.eligible_for_purge > 0)} onClick={() => void retentionPurge()}>
              {retentionBusy === 'purge' ? 'Sletter…' : 'Slett utløpte selfies'}
            </Btn>
          </div>
          {retentionMsg ? <div className="info-banner" style={{ marginTop: 12 }}>{retentionMsg}</div> : null}
        </div>
      ) : null}

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
                <td>
                  {statusPill(v.driver_identity_status || v.status)}
                  {v.next_identity_check_at ? <div className="cell-sub">Neste: {fmtDate(v.next_identity_check_at)}</div> : null}
                  {v.identity_recheck_deferred ? <div className="cell-sub">Aktiveres etter aktiv tur</div> : null}
                </td>
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
              <div style={{ marginBottom: 16 }}>{statusPill(selected.driver_identity_status || selected.status)}</div>
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
              <div className="kv"><div className="k">Neste planlagte kontroll</div><div className="v">{fmtDate(selected.next_identity_check_at)}</div></div>
              <div className="kv"><div className="k">Re-check trigger</div><div className="v">{selected.identity_recheck_trigger || '—'}</div></div>
              {selected.identity_recheck_reason ? <div className="info-banner" style={{ marginTop: 14 }}>Ny kontroll: {selected.identity_recheck_reason}{selected.identity_recheck_deferred ? ' · aktiveres etter aktiv tur' : ''}</div> : null}
              {selected.review_reason ? <div className="error-banner" style={{ marginTop: 14 }}>{selected.review_reason}</div> : null}

              {(selected.driver_identity_status || selected.status) === 'verified' ? (
                <>
                  <div className="section-title">Risikobasert kontroll</div>
                  <div className="info-banner">
                    KJAPP planlegger automatisk ny Selfie ID etter 30–90 dager. Ny appinstallasjon, lengre inaktivitet eller manuell vurdering kan kreve kontroll tidligere.
                  </div>
                  <Btn disabled={busy === `recheck-${selected.driver_id}`} onClick={() => void requestRecheck(selected)}>Krev ny Selfie ID</Btn>
                </>
              ) : null}

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
