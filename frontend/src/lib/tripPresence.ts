/** Driver coordinates may be shown as last-known; ETA requires fresh server GPS. */
export function driverPresence(trip: any, now = Date.now()) {
  const lat = trip?.driver_lat, lng = trip?.driver_lng;
  const hasPosition = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const stamp = typeof trip?.driver_location_at === 'string' ? Date.parse(trip.driver_location_at) : NaN;
  const age = now - stamp;
  const fresh = hasPosition && Number.isFinite(age) && age >= -5000 && age <= 30000;
  return { hasPosition, fresh };
}

/** Straight-line proximity is a presentation hint, never an arrival/completion decision. */
export function destinationProximity(trip: any, now = Date.now()) {
  if (trip?.status !== 'in_trip' || !driverPresence(trip, now).fresh) return null;
  const lat = trip.dropoff_lat, lng = trip.dropoff_lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(lat - trip.driver_lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(trip.driver_lat)) * Math.sin(radians(lng - trip.driver_lng) / 2) ** 2;
  const meters = Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))));
  return { meters, near: meters <= 400 };
}

/** Approach is based on fresh server road distance, never the prototype timer. */
export function driverApproaching(trip: any, now = Date.now()) {
  return trip?.status === 'driver_on_way' && driverPresence(trip, now).fresh
    && typeof trip.driver_distance_to_pickup_km === 'number' && Number.isFinite(trip.driver_distance_to_pickup_km)
    && trip.driver_distance_to_pickup_km >= 0 && trip.driver_distance_to_pickup_km <= .3;
}

/** Display estimate from the server arrival timestamp; actual waiting fees stay server-owned. */
export function pickupFreeWait(trip: any, now = Date.now()): string | null {
  const minutes = trip?.waiting_policy?.free_minutes;
  const arrived = typeof trip?.at_pickup_at === 'string' ? Date.parse(trip.at_pickup_at) : NaN;
  if (trip?.status !== 'at_pickup' || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0
    || !Number.isFinite(arrived) || arrived > now || !Number.isFinite(now)) return null;
  const seconds = Math.max(0, Math.ceil(minutes * 60 - (now - arrived) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
