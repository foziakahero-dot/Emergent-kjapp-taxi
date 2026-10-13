/** History is privacy-limited by the backend; never infer exact addresses or routes. */
export type DriverHistoryTrip = {
  trip_id?: string; status?: string; payment_status?: string; created_at?: string; arrived_at?: string;
  pickup_address?: string; dropoff_address?: string; price?: number; driver_earnings?: number | null;
  distance_km?: number | null; duration_min?: number | null; receipt_id?: string;
};
export function historyTrips(data: any): DriverHistoryTrip[] {
  const list = data?.trips ?? data?.history ?? data;
  return Array.isArray(list) ? list.filter(trip => trip && typeof trip.trip_id === 'string') : [];
}
export function confirmedTripIncome(trip: DriverHistoryTrip): number | null {
  return trip.payment_status === 'paid' && typeof trip.driver_earnings === 'number' && Number.isFinite(trip.driver_earnings) && trip.driver_earnings >= 0 ? trip.driver_earnings : null;
}
export function tripStatusLabel(trip: DriverHistoryTrip) {
  if (['cancelled', 'cancelled_by_driver'].includes(trip.status || '')) return 'Kansellert';
  if (['arrived', 'completed', 'rated'].includes(trip.status || '')) return trip.payment_status === 'paid' ? 'Fullført' : 'Venter på betaling';
  return 'Status ikke tilgjengelig';
}
export function historyDate(value?: string, timeOnly = false) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Dato mangler';
  return timeOnly ? date.toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short', year: 'numeric' });
}
export function groupHistory(trips: DriverHistoryTrip[], now = new Date()): { title: string; trips: DriverHistoryTrip[] }[] {
  const today = historyDate(now.toISOString());
  const yesterday = historyDate(new Date(now.getTime() - 864e5).toISOString());
  const groups = new Map<string, DriverHistoryTrip[]>();
  for (const trip of trips) {
    const day = historyDate(trip.created_at);
    const title = day === today ? 'I dag' : day === yesterday ? 'I går' : day;
    groups.set(title, [...(groups.get(title) || []), trip]);
  }
  return [...groups].map(([title, trips]) => ({ title, trips }));
}
