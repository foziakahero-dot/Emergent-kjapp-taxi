import React, { useEffect, useRef, useState } from 'react';
import { http, apiError } from './api';

type Receipt = { trip_id: string; receipt_number: string; gross_amount: number; currency: string;
  payment_method: string; paid_at: string; customer_email_sent_at?: string; driver_email_sent_at?: string;
  email_delivery_pending?: boolean; email_delivery_attempts?: number };
export default function Receipts() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [configured, setConfigured] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setRows([]); setError('');
    http.get('/admin/receipts', { params: { page, page_size: 25 } }).then(r => {
      if (active) { setRows(r.data.receipts); setTotal(r.data.total); setConfigured(r.data.email_configured); }
    }).catch(e => { if (active) setError(apiError(e)); });
    return () => { active = false; };
  }, [page, reload]);
  const retry = async (trip: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(trip); setError('');
    try { await http.post(`/admin/receipts/${encodeURIComponent(trip)}/retry-delivery`); setReload(v => v + 1); }
    catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusy(''); }
  };
  return <div className="page-content"><h1>Kvitteringer</h1>
    <p>Kun betalte turer gir betalingskvittering. Kontanttur må være bekreftet mottatt. Beløpene hentes fra det lagrede kvitteringsregisteret.</p>
    {!configured ? <p role="status">E-post er ikke konfigurert. Kvitteringene er lagret; automatisk levering venter på oppsett.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" disabled={!!busy} onClick={() => setReload(v => v + 1)}>Oppdater</button>
    <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Kvittering</th><th>Betalt</th><th>Beløp</th><th>Metode</th><th>Kunde e-post</th><th>Sjåfør e-post</th><th>Levering</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.trip_id}><td>{row.receipt_number}</td><td>{row.paid_at}</td><td>{row.gross_amount} {row.currency}</td><td>{row.payment_method === 'cash' ? 'Kontant' : row.payment_method}</td>
        <td>{row.customer_email_sent_at ? 'Sendt' : 'Ikke sendt'}</td><td>{row.driver_email_sent_at ? 'Sendt' : 'Ikke sendt'}</td>
        <td>{row.email_delivery_pending ? ((row.email_delivery_attempts || 0) >= 8 ? 'Krever oppfølging' : 'I kø') : 'Ingen ventende levering'}
          <button type="button" disabled={!configured || !!busy} onClick={() => void retry(row.trip_id)}>Prøv manglende levering igjen</button></td></tr>)}
    </tbody></table></div>
    {!rows.length ? <p>Ingen kvitteringer på denne siden.</p> : null}
    <button type="button" disabled={page <= 1 || !!busy} onClick={() => setPage(v => v - 1)}>Forrige</button>
    <span> Side {page} · {total} kvitteringer </span>
    <button type="button" disabled={page * 25 >= total || !!busy} onClick={() => setPage(v => v + 1)}>Neste</button>
  </div>;
}
