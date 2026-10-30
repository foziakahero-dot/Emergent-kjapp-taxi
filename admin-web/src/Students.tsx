import React, { useEffect, useRef, useState } from 'react';
import { http, apiError } from './api';

type Application = { customer_id: string; customer_name: string; revision: string; institution: string; valid_until: string; status: string; submitted_at: string };
export default function Students() {
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [proof, setProof] = useState<{ revision: string; url: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setRows([]); setSelected(null); setError('');
    http.get('/admin/student-verifications', { params: { status: filter } })
      .then(r => { if (active) setRows(r.data.applications); }).catch(e => { if (active) setError(apiError(e)); });
    return () => { active = false; };
  }, [filter, reload]);
  useEffect(() => {
    let active = true;
    let url = '';
    setProof(null); setReason('');
    if (selected?.status === 'pending') {
      http.get(`/admin/student-verifications/${encodeURIComponent(selected.customer_id)}/proof`, { params: { revision: selected.revision }, responseType: 'blob' })
        .then(r => { if (active) { url = URL.createObjectURL(r.data); setProof({ revision: selected.revision, url }); } })
        .catch(e => { if (active) setError(apiError(e)); });
    }
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [selected]);
  const review = async (decision: 'verified' | 'rejected' | 'revoked') => {
    if (!selected || lock.current || reason.trim().length < 3) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await http.post(`/admin/student-verifications/${encodeURIComponent(selected.customer_id)}/review`, { decision, revision: selected.revision, reason });
      setReload(v => v + 1);
    } catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="page-content">
    <h1>Studentverifisering</h1><p>Kontroller at dokumentet gjelder kunden, studiestedet og gyldighetsdatoen. Ingen studentrabatt er aktivert. Dokumentet slettes etter behandling. Dokumenttilgangen stenges etter sju dager, og bildet slettes automatisk.</p>
    <label>Vis <select aria-label="Søknadsstatus" value={filter} onChange={e => setFilter(e.target.value)} disabled={busy}>
      <option value="pending">Venter på kontroll</option><option value="verified">Godkjente</option><option value="rejected">Avslåtte</option><option value="revoked">Trukket tilbake</option>
    </select></label><button type="button" onClick={() => setReload(v => v + 1)} disabled={busy}>Oppdater</button>
    {error ? <p role="alert">{error}</p> : null}
    <p>Maksimalt 100 siste søknader vises per status.</p>
    <ul>{rows.map(row => <li key={row.customer_id}><button type="button" disabled={busy} onClick={() => { setSelected(row); setError(''); }}>
      {row.customer_name || row.customer_id} · {row.institution} · {row.status} · gyldig til {row.valid_until}</button></li>)}</ul>
    {!rows.length ? <p>Ingen søknader i denne listen.</p> : null}
    {selected ? <section aria-label="Behandle studentstatus">
      <h2>{selected.institution}</h2><p>Kunde: {selected.customer_name || selected.customer_id} · Gyldig til {selected.valid_until}</p>
      {proof?.revision === selected.revision ? <img src={proof.url} alt="Privat studentdokument til kontroll" style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh' }} /> : null}
      <label>Begrunnelse til kunden<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={300} disabled={busy} /></label>
      {selected.status === 'pending' ? <><button type="button" disabled={busy || proof?.revision !== selected.revision || reason.trim().length < 3} onClick={() => void review('verified')}>Dokument kontrollert – godkjenn</button>
        <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void review('rejected')}>Avslå</button></> : null}
      {selected.status === 'verified' ? <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void review('revoked')}>Trekk tilbake godkjenning</button> : null}
    </section> : null}
  </div>;
}
