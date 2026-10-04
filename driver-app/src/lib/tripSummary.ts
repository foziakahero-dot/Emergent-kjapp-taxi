export function finishedTripDismissalKey(userId: string) {
  return `kjapp_driver_dismissed_finished_trip_v2:${userId}`;
}

export function finishedTripReceipt(trip: { trip_id: string; payment_status?: string }) {
  // Dismissing a pending summary must not hide its later confirmed earnings.
  return `${trip.trip_id}:${trip.payment_status === 'paid' ? 'paid' : 'pending'}`;
}

export function canAutoDismissFinishedTrip(trip: { payment_status?: string } | null, visible = true) {
  return visible && trip?.payment_status === 'paid';
}
