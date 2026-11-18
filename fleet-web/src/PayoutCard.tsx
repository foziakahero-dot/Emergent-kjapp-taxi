import { api } from './api';
import { payoutStatus } from './payoutStatus';
import { useDashboardResource } from './useDashboardResource';

async function loadPayout() {
  const value = payoutStatus(await api.payouts());
  if (value.kind === 'unknown') throw new Error('Utbetalingsstatus kunne ikke kontrolleres');
  return value;
}

export function PayoutCard() {
  const r = useDashboardResource(loadPayout, 30_000);
  const current = r.status === 'ready' ? r.data : undefined;
  const failed = r.status === 'error' || r.status === 'stale';
  const amount = current?.kind === 'incoming' ? new Intl.NumberFormat('nb-NO', { style: 'currency', currency: current.currency }).format(current.amount) : '—';
  const detail = current?.kind === 'incoming'
    ? `${current.status === 'in_transit' ? 'Under overføring' : 'Planlagt'} · ${new Date(current.arrival).toLocaleDateString('nb-NO')}`
    : current?.kind === 'none' ? 'Ingen kommende utbetaling'
    : current?.kind === 'disconnected' ? 'Stripe-utbetaling er ikke koblet til'
    : failed ? 'Utbetalingsstatus kunne ikke kontrolleres' : 'Kontrollerer utbetaling …';
  return <section className="v2-kpi" aria-label="Neste Stripe-utbetaling">
    <span className="v2-kpi-icon red" aria-hidden="true">▣</span>
    <div><small>Neste Stripe-utbetaling</small><strong>{amount}</strong><em>{detail}</em>
      {r.updatedAt && <small>{failed ? 'Utdatert · sist kontrollert' : 'Kontrollert'} {new Date(r.updatedAt).toLocaleTimeString('nb-NO')}</small>}
      {failed && <button type="button" className="v2-link-button" disabled={r.pending} onClick={() => void r.retry()}>Prøv igjen for utbetaling</button>}
    </div>
  </section>;
}
