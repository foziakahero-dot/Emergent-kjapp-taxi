// Sequential, foreground-only estimates. A previous route's result is never published.
export function startQuoteRefresh<T>(options: {
  fetch: () => Promise<T>; publish: (quote: T) => void; fail: (error: unknown) => void;
  stale: () => void; blocked: () => boolean; active: boolean;
}) {
  let disposed = false, active = options.active, running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => { if (!disposed && active) timer = setTimeout(refresh, 30000); };
  async function refresh() {
    clearTimeout(timer);
    if (disposed || !active || running) return;
    if (options.blocked()) { schedule(); return; }
    running = true;
    try {
      const quote = await options.fetch();
      if (!disposed && active && !options.blocked()) {
        options.publish(quote);
        clearTimeout(expiry);
        expiry = setTimeout(() => { if (!disposed) options.stale(); }, 45000);
      }
    } catch (error) {
      if (!disposed && active && !options.blocked()) { options.stale(); options.fail(error); }
    } finally { running = false; schedule(); }
  }
  void refresh();
  return {
    setActive(next: boolean) {
      if (active === next) return;
      active = next; clearTimeout(timer);
      if (active) void refresh();
      else options.stale();
    },
    stop() { disposed = true; clearTimeout(timer); clearTimeout(expiry); },
  };
}
