import React, { useCallback, useEffect, useState } from 'react';
import { http, apiError } from './api';

export const fmtMoney = (v: any) =>
  (v === null || v === undefined ? '—' : new Intl.NumberFormat('no-NO').format(Math.round(v)) + ' kr');

export const fmtDate = (v: any) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('no-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return String(v); }
};
export const fmtDay = (v: any) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return String(v); }
};

export const Loader = () => (
  <div className="center"><div className="spinner" /></div>
);

export const Empty = ({ title = 'Ingen data', sub = '' }: { title?: string; sub?: string }) => (
  <div className="empty"><div className="big">{title}</div>{sub && <div>{sub}</div>}</div>
);

export const ErrorBanner = ({ msg }: { msg: string }) => (msg ? <div className="error-banner">{msg}</div> : null);

// ---- status → pill class + label ----
const STATUS_MAP: Record<string, { c: string; t?: string }> = {
  searching: { c: 'amber', t: 'Søker' }, booking: { c: 'amber', t: 'Bestiller' },
  driver_on_way: { c: 'blue', t: 'På vei' }, at_pickup: { c: 'blue', t: 'Ved henting' },
  in_trip: { c: 'blue', t: 'Underveis' }, arrived: { c: 'green', t: 'Fullført' },
  completed: { c: 'green', t: 'Fullført' }, rated: { c: 'green', t: 'Fullført' },
  cancelled: { c: 'red', t: 'Avbrutt' }, cancelled_by_driver: { c: 'red', t: 'Avbrutt (sjåfør)' },
  captured: { c: 'green', t: 'Betalt' }, paid: { c: 'green', t: 'Betalt' },
  pending: { c: 'amber', t: 'Venter' }, failed: { c: 'red', t: 'Feilet' }, recorded: { c: 'gold', t: 'Registrert' },
  refunded: { c: 'gold', t: 'Refundert' }, authorized: { c: 'blue', t: 'Autorisert' },
  open: { c: 'amber', t: 'Åpen' }, in_progress: { c: 'blue', t: 'Under arbeid' },
  waiting_for_user: { c: 'gray', t: 'Venter bruker' }, resolved: { c: 'green', t: 'Løst' }, closed: { c: 'gray', t: 'Lukket' },
  VALID: { c: 'green', t: 'Gyldig' }, EXPIRING: { c: 'amber', t: 'Utløper snart' }, EXPIRED: { c: 'red', t: 'Utløpt' },
  PENDING: { c: 'gray', t: 'Venter' }, REJECTED: { c: 'red', t: 'Avvist' },
};
export const Pill = ({ status, label }: { status?: string; label?: string }) => {
  const m = STATUS_MAP[status || ''] || { c: 'gray' };
  return <span className={`pill ${m.c}`}><span className="dot" />{label || m.t || status || '—'}</span>;
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`card ${className}`}>{children}</div>
);

export const Kpi = ({ label, value, foot, accent }: any) => (
  <div className="card">
    <div className="kpi-label">{label}</div>
    <div className={`kpi-value ${accent ? 'kpi-accent' : ''}`}>{value}</div>
    {foot ? <div className="kpi-foot">{foot}</div> : null}
  </div>
);

export const Btn: React.FC<any> = ({ children, variant = '', className = '', ...p }) => (
  <button className={`btn ${variant} ${className}`} {...p}>{children}</button>
);

export const PageHead = ({ title, sub, right }: any) => (
  <div className="page-head">
    <div><div className="page-title">{title}</div>{sub && <div className="page-sub">{sub}</div>}</div>
    {right}
  </div>
);

export function Drawer({ title, onClose, children }: any) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ title, sub, onClose, children }: any) {
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>{sub && <div className="sub">{sub}</div>}{children}
      </div>
    </div>
  );
}

export const KV = ({ k, v }: any) => (
  <div className="kv"><div className="k">{k}</div><div className="v">{v ?? '—'}</div></div>
);

export function Route({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="route">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="dot2" style={{ background: 'var(--green)' }} />
        <div className="line" />
        <div className="dot2" style={{ background: 'var(--text)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5 }}>{from || '—'}</div>
        <div style={{ height: 14 }} />
        <div style={{ fontSize: 13.5 }}>{to || '—'}</div>
      </div>
    </div>
  );
}

export function Bars({ data, xkey, ykey }: { data: any[]; xkey: string; ykey: string }) {
  const max = Math.max(1, ...data.map((d) => d[ykey] || 0));
  return (
    <div>
      <div className="bars">
        {data.map((d, i) => (
          <div key={i} className={`bar ${i === data.length - 1 ? 'hot' : ''}`}
            style={{ height: `${Math.max(3, ((d[ykey] || 0) / max) * 100)}%` }} title={`${d[xkey]}: ${d[ykey]}`} />
        ))}
      </div>
      <div className="bars-x">
        {data.map((d, i) => (
          <span key={i}>{(i % Math.ceil(data.length / 7) === 0) ? String(d[xkey]).slice(5) : ''}</span>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPage }: any) {
  if (total === 0) return null;
  return (
    <div className="pager">
      <span>{total} totalt · side {page} av {totalPages}</span>
      <Btn variant="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Forrige</Btn>
      <Btn variant="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Neste ›</Btn>
    </div>
  );
}

// ---- data hooks ----
export function useAsync<T = any>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reload = useCallback(() => {
    setLoading(true); setErr('');
    fn().then((d) => setData(d)).catch((e) => setErr(apiError(e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, err, reload, setData };
}

export function usePaged(path: string, params: any) {
  const [state, setState] = useState<any>({ rows: [], total: 0, page: 1, pageSize: params.page_size || 50, totalPages: 1, loading: true, err: '', extra: {} });
  const key = JSON.stringify({ path, params });
  const reload = useCallback(() => {
    setState((s: any) => ({ ...s, loading: true, err: '' }));
    http.get(path, { params }).then((r) => {
      const d = r.data;
      setState({ rows: d.items || [], total: d.total || 0, page: d.page || 1, pageSize: d.page_size || (params.page_size || 50), totalPages: d.total_pages || 1, loading: false, err: '', extra: d });
    }).catch((e) => setState((s: any) => ({ ...s, loading: false, err: apiError(e) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
