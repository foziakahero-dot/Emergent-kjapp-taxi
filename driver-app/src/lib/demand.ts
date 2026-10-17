export type DemandCell = { lat: number; lng: number; weight: number };
export type DemandZone = DemandCell & { label?: string; recent: number; typical: number; drivers: number; avg_earnings?: number };
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const coordinate = (v: any) => finite(v?.lat) && Math.abs(v.lat) <= 85 && finite(v?.lng) && Math.abs(v.lng) <= 180;
/** Reject stale/malformed results instead of displaying cached recommendations as live. */
export function usableDemand(data: any, now = Date.now()): { cells: DemandCell[]; zones: DemandZone[] } {
  const generated = Date.parse(data?.generated_at || '');
  if (!Number.isFinite(generated) || generated > now + 60000 || now - generated > 15 * 60000) return { cells: [], zones: [] };
  const valid = (v: any) => coordinate(v) && finite(v.weight) && v.weight > 0 && v.weight <= 1;
  const cells = Array.isArray(data.cells) ? data.cells.filter(valid).slice(0, 500) : [];
  const zones = Array.isArray(data.zones) ? data.zones.filter((v: any) => valid(v) && finite(v.recent) && v.recent >= 0 && finite(v.typical) && v.typical >= 0 && finite(v.drivers) && v.drivers >= 0 && v.recent + v.typical > 0).slice(0, 3) : [];
  return { cells, zones };
}
