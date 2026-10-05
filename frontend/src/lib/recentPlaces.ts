/** Recent destinations come only from the customer's actual finished trips. */
export function recentDestinations(trips: any[]) {
  const seen = new Set<string>();
  return trips.filter(trip => trip && ['arrived', 'completed', 'rated'].includes(trip.status)).flatMap(trip => {
    const name = typeof trip.dropoff_address === 'string' ? trip.dropoff_address.trim() : '';
    const lat = trip.dropoff_lat, lng = trip.dropoff_lng;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
    const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: `recent-${trip.trip_id}`, name, label: name, lat, lng, icon: 'clock', description: 'Nylig reisemål' }];
  }).slice(0, 8);
}
