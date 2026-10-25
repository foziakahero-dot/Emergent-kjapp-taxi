/** A sequential poller: retain the last quote, reject stale replies and never overlap requests. */
export function createQuotePoller({ fetchQuote, onQuote, onError, active, clock = { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (id: any) => clearTimeout(id) } }: {
  fetchQuote: () => Promise<any>; onQuote: (quote: any) => void; onError: (error: any) => void; active: () => boolean;
  clock?: { set: (fn: () => void, ms: number) => any; clear: (id: any) => void };
}) {
  let stopped = false, fetching = false, timer: any;
  const refresh = async () => {
    if (stopped || fetching) return;
    clock.clear(timer);
    if (!active()) { timer = clock.set(() => void refresh(), 30000); return; }
    fetching = true;
    try { const quote = await fetchQuote(); if (!stopped && active()) onQuote(quote); }
    catch (error) { if (!stopped && active()) onError(error); }
    finally { fetching = false; if (!stopped) timer = clock.set(() => void refresh(), 30000); }
  };
  void refresh();
  return { refresh, stop: () => { stopped = true; clock.clear(timer); } };
}
