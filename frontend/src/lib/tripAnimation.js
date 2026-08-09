/**
 * Given a trip, compute the driver's current position based on elapsed time.
 * - driver_on_way: linear interpolation from driver_start → pickup over eta_min minutes
 * - in_trip: walk along OSRM polyline from pickup → dropoff over duration_min minutes
 * Returns null if there's no meaningful animation state.
 */
export function computeDriverPosition(trip, nowMs = Date.now()) {
  if (!trip) return null;
  const status = trip.status;

  if (status === "driver_on_way") {
    if (trip.driver_start_lat == null || trip.driver_route_started_at == null) return null;
    const start = { lat: trip.driver_start_lat, lng: trip.driver_start_lng };
    const end = { lat: trip.pickup_lat, lng: trip.pickup_lng };
    const startedAt = new Date(trip.driver_route_started_at).getTime();
    const durationMs = Math.max(30_000, (trip.eta_min || 4) * 60 * 1000);
    const t = Math.max(0, Math.min(1, (nowMs - startedAt) / durationMs));
    return {
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
      bearing: bearingOf(start.lat, start.lng, end.lat, end.lng),
      progress: t,
    };
  }

  if (status === "in_trip") {
    if (!trip.trip_started_at) return null;
    const geom = trip.geometry?.coordinates;
    const startedAt = new Date(trip.trip_started_at).getTime();
    const durationMs = Math.max(30_000, (trip.duration_min || 6) * 60 * 1000);
    const t = Math.max(0, Math.min(1, (nowMs - startedAt) / durationMs));
    if (geom && geom.length >= 2) {
      return walkPolyline(geom, t);
    }
    // fallback linear
    return {
      lat: trip.pickup_lat + (trip.dropoff_lat - trip.pickup_lat) * t,
      lng: trip.pickup_lng + (trip.dropoff_lng - trip.pickup_lng) * t,
      bearing: bearingOf(trip.pickup_lat, trip.pickup_lng, trip.dropoff_lat, trip.dropoff_lng),
      progress: t,
    };
  }

  return null;
}

/** Walk along a [lng, lat] polyline; returns {lat, lng, bearing, progress} at fraction t (0..1). */
function walkPolyline(coords, t) {
  // Convert to [lat, lng] segments
  const pts = coords.map(([lng, lat]) => [lat, lng]);
  // Compute cumulative distances
  const dists = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    total += d;
    dists.push(total);
  }
  if (total === 0) {
    return { lat: pts[0][0], lng: pts[0][1], bearing: 0, progress: t };
  }
  const target = t * total;
  // Find segment
  let i = 1;
  while (i < dists.length && dists[i] < target) i++;
  if (i >= pts.length) i = pts.length - 1;
  const segStart = pts[i - 1];
  const segEnd = pts[i];
  const segLen = dists[i] - dists[i - 1];
  const segT = segLen === 0 ? 0 : (target - dists[i - 1]) / segLen;
  const lat = segStart[0] + (segEnd[0] - segStart[0]) * segT;
  const lng = segStart[1] + (segEnd[1] - segStart[1]) * segT;
  const bearing = bearingOf(segStart[0], segStart[1], segEnd[0], segEnd[1]);
  return { lat, lng, bearing, progress: t };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingOf(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lng1 * Math.PI) / 180;
  const λ2 = (lng2 * Math.PI) / 180;
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
