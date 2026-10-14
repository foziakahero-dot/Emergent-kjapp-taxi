import { validPosition } from './carAvailability';
type LL = { lat: number; lng: number };
export type MapFocusMode = 'nearby' | 'route' | 'destination';
export type MapContentInsets = { top: number; right: number; bottom: number; left: number };
const DEFAULT_INSETS: MapContentInsets = { top: 90, right: 58, bottom: 170, left: 58 };

export function mapContentInsets(width: number, height: number, requested?: Partial<MapContentInsets>): MapContentInsets {
  const result = { ...DEFAULT_INSETS, ...requested };
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    result[side] = Number.isFinite(result[side]) ? Math.max(0, Math.round(result[side])) : DEFAULT_INSETS[side];
  }
  // Keep a usable viewport on smaller screens or during a panel's layout transition.
  for (const [first, second, extent] of [['left', 'right', width], ['top', 'bottom', height]] as const) {
    const total = result[first] + result[second];
    const maximum = Math.max(0, extent - 64);
    if (total > maximum && total > 0) {
      const scale = maximum / total;
      result[first] = Math.floor(result[first] * scale);
      result[second] = Math.floor(result[second] * scale);
    }
  }
  return result;
}

export function fitMapView(points: LL[], width: number, height: number, requested?: Partial<MapContentInsets>) {
  const valid = points.filter(validPosition);
  if (!valid.length) return { center: { lat: 59.9127, lng: 10.7461 }, zoom: 13 };
  const padding = mapContentInsets(width, height, requested);
  const availableWidth = width - padding.left - padding.right;
  const availableHeight = height - padding.top - padding.bottom;
  for (let zoom = valid.length === 1 ? 16 : 18; zoom >= 3; zoom--) {
    const worldSize = 256 * 2 ** zoom;
    const xs = valid.map(p => (p.lng + 180) / 360 * worldSize);
    const ys = valid.map(p => {
      const s = Math.sin(Math.max(-85.051129, Math.min(85.051129, p.lat)) * Math.PI / 180);
      return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize;
    });
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    if (zoom === 3 || (maxX - minX <= availableWidth && maxY - minY <= availableHeight)) {
      // The center of the unobscured rectangle differs from the full map's center.
      const x = (minX + maxX + padding.right - padding.left) / 2;
      const y = (minY + maxY + padding.bottom - padding.top) / 2;
      const n = Math.PI - 2 * Math.PI * y / worldSize;
      return { center: { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lng: x / worldSize * 360 - 180 }, zoom };
    }
  }
  return { center: valid[0], zoom: 3 };
}

export function mapFocusPoints({ user, pickup, dropoff, activeCar, cars = [], focusMode = 'route', focusRoute }: {
  user?: LL | null; pickup?: LL | null; dropoff?: LL | null; activeCar?: LL | null;
  cars?: LL[]; focusMode?: MapFocusMode; focusRoute?: number[][] | null;
}): LL[] {
  // Nearby supply is framed around pickup; a distant destination must not hide cars.
  const nearby = !activeCar && (focusMode === 'nearby' || (!dropoff && cars.length > 0));
  const extents: LL[] = [];
  if (!nearby && focusRoute?.length) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const coordinate of focusRoute) {
      const point = { lat: coordinate?.[1], lng: coordinate?.[0] };
      if (!validPosition(point)) continue;
      minLat = Math.min(minLat, point.lat); maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng); maxLng = Math.max(maxLng, point.lng);
    }
    if (Number.isFinite(minLat)) extents.push({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng });
  }
  // Frame the complete road geometry once, independently of the animated line prefix.
  // Arrival frames the actual destination and driver, without the departed pickup
  // or complete road geometry forcing the camera back out to the whole journey.
  const points = focusMode === 'destination' ? [dropoff, activeCar] : nearby ? [pickup || user, ...cars] : extents.length ? [pickup || user, dropoff, activeCar, ...extents] : [user, pickup, dropoff, activeCar];
  const seen = new Set<string>();
  return points.filter((p): p is LL => {
    if (!validPosition(p)) return false;
    const key = `${p!.lat.toFixed(6)},${p!.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
