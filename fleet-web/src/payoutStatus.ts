import type { FleetPayout } from './api';

type Result = { kind: 'unknown' | 'disconnected' | 'none' } | {
  kind: 'incoming'; amount: number; currency: string; arrival: number; status: 'pending' | 'in_transit';
};
type Response = { payouts: FleetPayout[]; source?: string; connected?: boolean; temporarily_unavailable?: boolean };

// Only /fleet/payouts reports actual transfers; trip amounts, settlement estimates and cash do not.
export function payoutStatus(response: Response): Result {
  if (!response || response.temporarily_unavailable || !Array.isArray(response.payouts)) return { kind: 'unknown' };
  if (response.source === 'none' && response.connected === false && !response.payouts.length) return { kind: 'disconnected' };
  if (response.source !== 'stripe' || response.connected !== true) return { kind: 'unknown' };
  const osloDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = osloDay.format(new Date());
  let next: Extract<Result, { kind: 'incoming' }> | undefined;
  for (const row of response.payouts) {
    if (!row || row.source !== 'stripe') return { kind: 'unknown' };
    if (['paid', 'failed', 'canceled'].includes(row.status || '')) continue;
    if (row.status !== 'pending' && row.status !== 'in_transit') return { kind: 'unknown' };
    const arrival = Date.parse(row.arrival_date || '');
    if (!Number.isFinite(arrival) || typeof row.amount !== 'number' || !Number.isFinite(row.amount) || !/^[A-Z]{3}$/.test(row.currency || '')) return { kind: 'unknown' };
    if (osloDay.format(arrival) < today) return { kind: 'unknown' };
    if (!next || arrival < next.arrival) next = { kind: 'incoming', arrival, amount: row.amount, currency: row.currency!, status: row.status };
  }
  return next || { kind: 'none' };
}
