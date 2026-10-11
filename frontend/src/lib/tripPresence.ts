/** Driver coordinates may be shown as last-known; ETA requires fresh server GPS. */
export function driverPresence(trip: any, now = Date.now()) {
  const lat = trip?.driver_lat, lng = trip?.driver_lng;
  const hasPosition = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const stamp = typeof trip?.driver_location_at === 'string' ? Date.parse(trip.driver_location_at) : NaN;
  const age = now - stamp;
  const fresh = hasPosition && Number.isFinite(age) && age >= -5000 && age <= 30000;
  return { hasPosition, fresh };
}
