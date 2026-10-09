import { validPosition } from './carAvailability';
type LL = { lat: number; lng: number };
export type MapFocusMode = 'nearby' | 'route';
export function mapFocusPoints({ user, pickup, dropoff, activeCar, cars = [], focusMode = 'route' }: {
  user?: LL | null; pickup?: LL | null; dropoff?: LL | null; activeCar?: LL | null;
  cars?: LL[]; focusMode?: MapFocusMode;
}): LL[] {
  // Nearby supply is framed around pickup; a distant destination must not hide cars.
  const nearby = !activeCar && (focusMode === 'nearby' || (!dropoff && cars.length > 0));
  const points = nearby ? [pickup || user, ...cars] : [user, pickup, dropoff, activeCar];
  const seen = new Set<string>();
  return points.filter((p): p is LL => {
    if (!validPosition(p)) return false;
    const key = `${p!.lat.toFixed(6)},${p!.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
