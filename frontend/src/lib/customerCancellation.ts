import { tripsApi } from '@/src/lib/api';
import { kr } from '@/src/lib/format';

export const CUSTOMER_CANCELLABLE_STATUSES = ['payment_authorizing', 'searching', 'booking', 'driver_on_way', 'at_pickup'];
export const cancelledTrip = (status: unknown) => status === 'cancelled' || status === 'cancelled_by_driver';

export async function cancellationFee(tripId: string): Promise<number> {
  const preview = await tripsApi.cancelPreview(tripId);
  const fee = preview?.cancellation_fee;
  if (preview?.currency !== 'NOK' || typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0) {
    throw new Error('Ugyldige avbestillingsvilkår.');
  }
  return fee;
}

export function cancellationTerms(fee: number) {
  return fee > 0 ? `Avbestillingsgebyr akkurat nå: ${kr(fee)}.`
    : 'Ingen avbestillingsgebyr gjelder akkurat nå.';
}
