import { useEffect, useState } from 'react';
import { driverPresence } from './tripPresence';
import type { MapCarData } from './liveCars';

/** A stopped HTTP stream must not leave an assigned car presented as live forever. */
export function useAssignedVehicle(trip: any): MapCarData | null {
  const [, refresh] = useState(0);
  const fresh = driverPresence(trip).fresh;
  const stamp = trip?.driver_location_at;
  useEffect(() => {
    if (!fresh) return;
    const remaining = Date.parse(stamp) + 30_001 - Date.now();
    const timer = setTimeout(() => refresh(value => value + 1), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [stamp, fresh]);
  if (!fresh || !trip?.driver_id || !['driver_on_way', 'at_pickup', 'in_trip'].includes(trip.status)) return null;
  return {
    id: trip.driver_id, lat: trip.driver_lat, lng: trip.driver_lng,
    heading: trip.driver_heading, type: trip.vehicle_type,
  };
}
