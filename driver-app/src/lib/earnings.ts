export type DatedTrip = {
  created_at?: string;
};

export function monthToDateTrips<T extends DatedTrip>(trips: T[], now = new Date()): T[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return trips.filter((trip) => (trip.created_at || '') >= monthStart);
}
