import { validPosition, type LiveCar } from './carAvailability';

export const NEARBY_RADIUS_KM = 5;
type Point = { lat: number; lng: number };
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
/** The server checks approval, compliance and availability. Fail closed on stale/invalid GPS. */
export function nearbyDrivers(result: any, pickup: Point, now = Date.now(), vehicleType?: string): LiveCar[] {
  if (!validPosition(pickup) || !Array.isArray(result?.cars)) return [];
  const serverTime = Date.parse(result.server_time);
  const reference = Number.isFinite(serverTime) ? serverTime : now;
  const maxAge = Math.min(60, Math.max(1, Number(result.gps_fresh_seconds) || 60)) * 1000;
  const ids = new Set<string>();
  return result.cars.filter((car: any) => {
    if (!car?.id || ids.has(car.id) || !validPosition(car) || car.online === false || car.available === false) return false;
    if (vehicleType && car.type !== vehicleType) return false;
    const updated = Date.parse(car.updated_at);
    if (!Number.isFinite(updated) || reference - updated > maxAge || updated - reference > 5000) return false;
    if (distanceKm(pickup, car) > NEARBY_RADIUS_KM) return false;
    ids.add(car.id); return true;
  });
}
