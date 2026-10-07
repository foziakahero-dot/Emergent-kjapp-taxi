import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiError, FleetDocument } from './api';

type Filter = 'all' | 'driver' | 'vehicle' | 'fleet' | 'expiring' | 'pending' | 'expired';

const fmtDate = (value?: string) => value
  ? new Date(value).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—';

const statusLabel: Record<string, string> = {
  VALID: 'Godkjent',
  EXPIRING: 'Utløper snart',
  EXPIRED: 'Utløpt',
  PENDING: 'Til kontroll',
  REJECTED: 'Avvist',
  MISSING: 'Mangler',
};

const statusTone: Record<string, string> = {
  VALID: 'good',
  EXPIRING: 'warn',
  EXPIRED: 'bad',
  PENDING: 'warn',
  REJECTED: 'bad',
  MISSING: 'bad',
};

const typeLabel = (doc: FleetDocument) => {
  const raw = String(doc.doc_type || '').toLowerCase();
  if (raw === 'taxi_license') return 'Kjøreseddel';
  if (raw === 'profile_photo') return 'Profilbilde';
  if (raw.includes('driver') || raw.includes('license') || raw.includes('førerkort')) return 'Førerkort';
  if (raw.includes('taxi') || raw.includes('kjøreseddel')) return 'Kjøreseddel';
  if (raw.includes('insurance') || raw.includes('forsikring')) return 'Forsikring';
  if (raw.includes('registration') || raw.includes('vognkort')) return 'Vognkort';
  if (raw.includes('eu')) return 'EU-kontroll';
  if (raw.includes('permit') || raw.includes('løyve')) return 'Løyve';
  return doc.doc_type || 'Dokument';
};

export function FigmaDocumentsPage() {
  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let alive = true;
    api.documents().then((result) => {
      if (!alive) return;
      setDocuments(result.documents || []);
      setSummary(result.summary || {});
      setError('');
    }).catch((e) => alive && setError(apiError(e)));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const ownerType = String(doc.owner_type || '').toLowerCase();
      const compliance = String(doc.compliance || '').toUpperCase();
      const matchesFilter = filter === 'all'
        || filter === ownerType
        || (filter === 'expiring' && compliance === 'EXPIRING')
        || (filter === 'pending' && compliance === 'PENDING')
        || (filter === 'expired' && ['EXPIRED', 'REJECTED'].includes(compliance));
      if (!matchesFilter) return false;
      if (!q) return true;
      return [doc.filename, doc.doc_type, doc.owner_name, doc.owner_type, compliance]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [documents, filter, query]);

  const openDocument = async (doc: FleetDocument) => {
    if (!doc.storage_path || busyId) return;
    setBusyId(doc.id);
    setError('');
    try {
      const blob = await api.downloadFile(doc.storage_path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusyId('');
    }
  };

  const avvik = (summary.EXPIRED || 0) + (summary.REJECTED || 0);

  return <div className="figma-page figma-documents-page">
    <div className="figma-page-head">
      <div>
        <span className="figma-kicker">DOKUMENTER</span>
        <h1>Dokumentoversikt</h1>
        <p>Full oversikt over flåte-, sjåfør- og kjøretøydokumenter.</p>
      </div>
      <Link className="figma-primary-link" to="/kjoretoy">Administrer kjøretøydokumenter</Link>
    </div>

    <div className="figma-doc-kpis">
      <div className="figma-card doc-kpi"><span>Godkjent</span><strong>{summary.VALID || 0}</strong><small>gyldige dokumenter</small></div>
      <div className="figma-card doc-kpi"><span>Utløper snart</span><strong>{summary.EXPIRING || 0}</strong><small>krever oppfølging</small></div>
      <div className="figma-card doc-kpi"><span>Til kontroll</span><strong>{summary.PENDING || 0}</strong><small>venter SNAR-godkjenning</small></div>
      <div className="figma-card doc-kpi danger"><span>Avvik</span><strong>{avvik}</strong><small>utløpt eller avvist</small></div>
    </div>

    <section className="figma-card figma-doc-table-card">
      <div className="figma-doc-toolbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk dokument, eier eller type…" />
        <div className="figma-filter-row">
          {([
            ['all', 'Alle'], ['driver', 'Sjåfører'], ['vehicle', 'Kjøretøy'], ['fleet', 'Flåte'],
            ['expiring', 'Utløper snart'], ['pending', 'Til kontroll'], ['expired', 'Avvik'],
          ] as Array<[Filter, string]>).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>

      <div className="figma-data-table figma-doc-table">
        <div className="figma-tr head"><span>Dokument</span><span>Eier</span><span>Type</span><span>Utløper</span><span>Status</span><span /></div>
        {filtered.map((doc) => <div className="figma-tr" key={doc.id}>
          <span className="doc-name"><i>▤</i><b>{doc.filename || typeLabel(doc)}</b></span>
          <span><strong>{doc.owner_name || (doc.owner_type === 'fleet' ? 'Flåten' : 'Ikke angitt')}</strong><small>{doc.owner_type === 'driver' ? 'Sjåfør' : doc.owner_type === 'vehicle' ? 'Kjøretøy' : 'Løyvehaver'}</small></span>
          <span>{typeLabel(doc)}</span>
          <span>{fmtDate(doc.expiry)}</span>
          <span><em className={`doc-status ${statusTone[doc.compliance] || 'neutral'}`}>{statusLabel[doc.compliance] || doc.compliance}</em></span>
          <span><button className="figma-row-action" disabled={!doc.storage_path || busyId === doc.id} onClick={() => void openDocument(doc)}>{busyId === doc.id ? 'Åpner…' : 'Åpne'}</button></span>
        </div>)}
        {!filtered.length ? <div className="figma-table-empty">Ingen dokumenter matcher filteret.</div> : null}
      </div>
    </section>

    {error ? <div className="figma-error">{error}</div> : null}
  </div>;
}

export default FigmaDocumentsPage;
