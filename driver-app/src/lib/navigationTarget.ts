export type NavigationPoint = { lat: number; lng: number };
const point = (lat: unknown, lng: unknown): NavigationPoint | null =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

export function navigationTarget(trip: any) {
  if (!trip?.trip_id || !['driver_on_way', 'in_trip'].includes(trip.status)) return null;
  const pickup = trip.status === 'driver_on_way';
  const destination = pickup ? point(trip.pickup_lat, trip.pickup_lng) : point(trip.dropoff_lat, trip.dropoff_lng);
  if (!destination) return null;
  const stops: NavigationPoint[] = [];
  if (!pickup && trip.stops != null && !Array.isArray(trip.stops)) return null;
  if (!pickup) for (const stop of trip.stops || []) {
    // Never silently skip a requested stop or turn invalid coordinates into (0, 0).
    const p = point(stop?.lat, stop?.lng);
    if (!p) return null;
    stops.push(p);
  }
  if (stops.length > 23) return null;
  const coordinates = [...stops, destination].map(p => [p.lng, p.lat]);
  return { key: JSON.stringify([trip.trip_id, trip.status, coordinates]), coordinates,
    label: pickup ? 'Til henting' : 'Til destinasjon' };
}
