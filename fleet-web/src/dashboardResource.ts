export type ResourceSnapshot<T> = {
  status: 'loading' | 'ready' | 'stale' | 'error';
  data?: T;
  updatedAt?: number;
  pending: boolean;
};

// One store per mounted resource. Polls and retries cannot overlap, and a
// response from a previous mount cannot publish into its successor.
export function createResource<T>(load: () => Promise<T>) {
  let state: ResourceSnapshot<T> = { status: 'loading', pending: false };
  let generation = 0;
  const listeners = new Set<() => void>();
  function publish(next: ResourceSnapshot<T>) {
    state = next;
    listeners.forEach(listener => listener());
  }
  async function refresh() {
    if (state.pending) return;
    const request = generation;
    publish({ ...state, pending: true });
    try {
      const data = await load();
      if (request === generation) publish({ status: 'ready', data, updatedAt: Date.now(), pending: false });
    } catch (error) {
      if (request !== generation) return;
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (state.data === undefined || status === 401 || status === 403) publish({ status: 'error', pending: false });
      else publish({ ...state, status: 'stale', pending: false });
    }
  }
  return {
    refresh,
    reset() { generation++; publish({ status: 'loading', pending: false }); },
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export function readList<K extends string, T>(response: Record<K, T[]>, key: K): T[] {
  const list = response?.[key];
  if (!Array.isArray(list) || !list.every(row => row && typeof row === 'object' && !Array.isArray(row))) throw Error('Ugyldig liste');
  return list;
}

export function readStripeReady(response: { ready: boolean }): boolean {
  if (typeof response?.ready !== 'boolean') throw Error('Ukjent betalingsstatus');
  return response.ready;
}
