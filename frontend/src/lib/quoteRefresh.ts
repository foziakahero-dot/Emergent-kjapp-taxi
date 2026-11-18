// Sequential, foreground-only estimates. Route disposal and foreground changes
// invalidate in-flight responses; a paused response must never become a fresh quote.
export const QUOTE_REFRESH_MS = 30000;
export const QUOTE_MAX_AGE_MS = 45000;
export function startQuoteRefresh<T>(options: {
  fetch: () => Promise<T>; publish: (quote: T) => void; fail: (error: unknown) => void;
  stale: () => void; blocked: () => boolean; active: boolean;
}) {
  let disposed = false, active = options.active, running = false, generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => { if (!disposed && active) timer = setTimeout(refresh, QUOTE_REFRESH_MS); };
  async function refresh() {
    clearTimeout(timer);
    if (disposed || !active || running) return;
    if (options.blocked()) { schedule(); return; }
    const requestGeneration = generation;
    running = true;
    try {
      const quote = await options.fetch();
      if (!disposed && active && requestGeneration === generation && !options.blocked()) {
        options.publish(quote);
        clearTimeout(expiry);
        expiry = setTimeout(() => { if (!disposed) options.stale(); }, QUOTE_MAX_AGE_MS);
      }
    } catch (error) {
      if (!disposed && active && requestGeneration === generation && !options.blocked()) { options.stale(); options.fail(error); }
    } finally {
      running = false;
      // A quick background/resume can happen while the old request is running.
      // Finish it without publishing, then immediately fetch a new foreground quote.
      if (!disposed && active && requestGeneration !== generation) void refresh();
      else schedule();
    }
  }
  void refresh();
  return {
    setActive(next: boolean) {
      if (active === next) return;
      generation++;
      active = next; clearTimeout(timer); clearTimeout(expiry);
      options.stale();
      if (active) void refresh();
    },
    stop() { disposed = true; clearTimeout(timer); clearTimeout(expiry); },
  };
}

// Signed tokens may rotate on every refresh. Compare the actual price and
// reservation terms, so an unchanged offer does not interrupt confirmation.
export function quoteTermsKey(quote: any, vehicle: string): string | null {
  const option = quote?.options?.find((item: any) => item.vehicle_type === vehicle);
  if (typeof option?.price !== 'number' || !Number.isFinite(option.price) || option.price <= 0) return null;
  const policy = option.waiting_policy;
  return JSON.stringify([option.price, quote.pricing_version,
    policy?.free_minutes, policy?.per_minute, policy?.max_fee]);
}
