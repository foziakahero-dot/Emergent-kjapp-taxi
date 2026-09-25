import React, { useEffect, useState } from 'react';
import { api, apiError } from './api';
import { Btn, Drawer, Empty, ErrorBanner, KV, Loader, PageHead, Pagination, Pill, Route, fmtDate, fmtMoney } from './ui';
import { useAuth } from './auth';

type Receipt = {
  id?: string;
  receipt_number: string;
  trip_id: string;
  customer_name?: string;
  customer_email?: string;
  driver_name?: string;
  driver_car?: string;
  driver_plate?: string;
  fleet_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  distance_km?: number;
  duration_min?: number;
  gross_amount?: number;
  platform_fee?: number;
  fleet_net?: number;
  commission_rate?: number;
  currency?: string;
  payment_status?: string;
  payment_method?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  settlement_model?: string;
  paid_at?: string;
  customer_email_sent_at?: string;
  driver_email_sent_at?: string;
  refunded_total?: number;
  refund_status?: string;
  refunds?: Array<{ id?: string; amount?: number; reason?: string; status?: string; created_at?: string }>;
  backfilled?: boolean;
};

export default function Receipts() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const next = await api.receipts({
        q: q.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        payment_method: paymentMethod || undefined,
        page,
        page_size: 50,
      });
      setData(next);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, dateFrom, dateTo, paymentMethod]);
  useEffect(() => { setPage(1); }, [q]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  const open = async (row: Receipt) => {
    setErr('');
    try { setSelected(await api.receipt(row.receipt_number || row.trip_id)); }
    catch (e) { setErr(apiError(e)); }
  };

  const backfill = async () => {
    if (user?.role !== 'superadmin') return;
    if (!window.confirm('Opprette historiske kvitteringssnapshot for allerede betalte beta-turer som mangler ledger-post?')) return;
    setBackfillBusy(true); setBackfillMsg(''); setErr('');
    try {
      const result = await api.backfillReceipts(1000);
      setBackfillMsg(`Kontrollert ${result.scanned || 0} turer · opprettet ${result.created || 0} kvitteringer.`);
      await load();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBackfillBusy(false);
    }
  };

  const rows: Receipt[] = data?.items || data?.receipts || [];

  return (
    <>
      <PageHead
        title="Kvitteringer"
        sub="Historiske betalingssnapshot for fullførte og betalte turer"
        right={user?.role === 'superadmin'
          ? <Btn variant="sm" disabled={backfillBusy} onClick={() => void backfill()}>{backfillBusy ? 'Bygger…' : 'Backfill beta'}</Btn>
          : null}
      />
      <div className="info-banner">
        Kvitteringen fryser pris, serviceavgift, flåteandel, betalingsreferanse og rute på betalingstidspunktet.
        Senere refusjoner vises som egne justeringer uten å skrive om originalsnapshotet.
      </div>
      {backfillMsg ? <div className="ok-banner" style={{ marginBottom: 14 }}>{backfillMsg}</div> : null}

      <form className="toolbar" onSubmit={search}>
        <input className="input" placeholder="Kvittering, tur, kunde, sjåfør eller flåte…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}>
          <option value="">Alle betalingsmåter</option>
          <option value="stripe_checkout">Stripe Checkout</option>
          <option value="saved_card">Lagret kort</option>
          <option value="card">Kort</option>
        </select>
        <input className="input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input className="input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Btn variant="sm" type="submit">Søk</Btn>
      </form>

      <ErrorBanner msg={err} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Kvittering</th><th>Kunde</th><th>Sjåfør / flåte</th><th>Betaling</th><th className="right">Beløp</th><th className="right">KJAPP</th><th>Tid</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><Loader /></td></tr> : rows.length ? rows.map((r) => (
              <tr key={r.receipt_number} className="click" onClick={() => void open(r)}>
                <td><div className="mono">{r.receipt_number}</div><div className="cell-sub">Tur {String(r.trip_id || '').slice(0, 8)}</div></td>
                <td><div>{r.customer_name || '—'}</div><div className="cell-sub">{r.customer_email || ''}</div></td>
                <td><div>{r.driver_name || '—'}</div><div className="cell-sub">{r.fleet_name || [r.driver_car, r.driver_plate].filter(Boolean).join(' · ') || ''}</div></td>
                <td><Pill status={r.payment_status || 'paid'} label={r.payment_method || 'Betalt'} /></td>
                <td className="right mono">{fmtMoney(r.gross_amount)}</td>
                <td className="right mono">{fmtMoney(r.platform_fee)}</td>
                <td className="dim nowrap">{fmtDate(r.paid_at)}</td>
              </tr>
            )) : <tr><td colSpan={7}><Empty title="Ingen kvitteringer funnet" sub="Betalte turer får automatisk kvitteringssnapshot." /></td></tr>}
          </tbody>
        </table>
        <Pagination page={data?.page || page} totalPages={data?.total_pages || 1} total={data?.total || rows.length} onPage={setPage} />
      </div>

      {selected ? (
        <Drawer title={selected.receipt_number || 'Kvittering'} onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 14 }}><Pill status={selected.payment_status || 'paid'} /></div>
          <div className="card" style={{ marginBottom: 16 }}>
            <Route from={selected.pickup_address} to={selected.dropoff_address} />
          </div>
          <KV k="Tur-ID" v={<span className="mono">{selected.trip_id}</span>} />
          <KV k="Kunde" v={selected.customer_name ? `${selected.customer_name} · ${selected.customer_email || ''}` : '—'} />
          <KV k="Sjåfør" v={selected.driver_name ? `${selected.driver_name} · ${selected.driver_car || ''} ${selected.driver_plate || ''}` : '—'} />
          <KV k="Løyvehaver" v={selected.fleet_name || '—'} />
          <KV k="Brutto" v={<span className="mono">{fmtMoney(selected.gross_amount)}</span>} />
          <KV k="KJAPP serviceavgift" v={<span className="mono">{fmtMoney(selected.platform_fee)} {selected.commission_rate != null ? `(${Math.round(Number(selected.commission_rate) * 1000) / 10}%)` : ''}</span>} />
          <KV k="Til flåte" v={<span className="mono">{fmtMoney(selected.fleet_net)}</span>} />
          <KV k="Betalingsmåte" v={selected.payment_method || '—'} />
          <KV k="Stripe PaymentIntent" v={<span className="mono">{selected.stripe_payment_intent_id || '—'}</span>} />
          <KV k="Stripe Session" v={<span className="mono">{selected.stripe_session_id || '—'}</span>} />
          <KV k="Betalt" v={fmtDate(selected.paid_at)} />
          <KV k="Kundekvittering sendt" v={selected.customer_email_sent_at ? fmtDate(selected.customer_email_sent_at) : 'Ikke registrert'} />
          <KV k="Sjåførkvittering sendt" v={selected.driver_email_sent_at ? fmtDate(selected.driver_email_sent_at) : 'Ikke registrert'} />
          <KV k="Refundert totalt" v={<span className="mono">{fmtMoney(selected.refunded_total || 0)}</span>} />
          {selected.backfilled ? <div className="info-banner" style={{ marginTop: 14 }}>Historisk beta-post opprettet ved backfill.</div> : null}

          <div className="section-title">Refusjonsjusteringer</div>
          {selected.refunds?.length ? selected.refunds.map((r, i) => (
            <div className="card" style={{ marginBottom: 10 }} key={r.id || i}>
              <KV k="Beløp" v={fmtMoney(r.amount)} />
              <KV k="Status" v={r.status || '—'} />
              <KV k="Begrunnelse" v={r.reason || '—'} />
              <KV k="Tid" v={fmtDate(r.created_at)} />
            </div>
          )) : <Empty title="Ingen refusjoner" />}
        </Drawer>
      ) : null}
    </>
  );
}
