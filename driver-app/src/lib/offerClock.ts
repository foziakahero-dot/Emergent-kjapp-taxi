/** Project server time with a monotonic clock, independent of the device wall clock. */
export function projectedOfferTime(serverTime: string | undefined, receivedAt: number, monotonicNow: number): number | null {
  const server = Date.parse(serverTime || '');
  if (!Number.isFinite(server) || !Number.isFinite(receivedAt) || !Number.isFinite(monotonicNow)) return null;
  return server + Math.max(0, monotonicNow - receivedAt);
}
