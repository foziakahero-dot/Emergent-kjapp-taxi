import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createResource, type ResourceSnapshot } from './dashboardResource';

export type DashboardResource<T> = ResourceSnapshot<T> & { retry: () => Promise<void> };

export function useDashboardResource<T>(load: () => Promise<T>, interval = 30_000): DashboardResource<T> {
  const store = useMemo(() => createResource(load), [load]);
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  useEffect(() => {
    void store.refresh();
    const timer = window.setInterval(store.refresh, interval);
    return () => { window.clearInterval(timer); store.reset(); };
  }, [store, interval]);
  return { ...snapshot, retry: store.refresh };
}

export function ResourceNotice({ resource, label }: { resource: DashboardResource<unknown>; label: string }) {
  if (resource.status === 'ready') return null;
  if (resource.status === 'loading') return <div className="dashboard-resource-note" role="status">Laster {label.toLocaleLowerCase('nb-NO')}…</div>;
  const last = resource.updatedAt === undefined ? null : new Date(resource.updatedAt);
  return <div className="dashboard-resource-note">
    <span role="status">{label}: {last ? <>Utdaterte data. Sist oppdatert <time dateTime={last.toISOString()}>{last.toLocaleString('nb-NO')}</time>.</> : 'Kunne ikke hente data.'}</span>{' '}
    <button type="button" className="v2-link-button" disabled={resource.pending} onClick={resource.retry} aria-label={`Prøv igjen: ${label}`}>{resource.pending ? 'Prøver…' : 'Prøv igjen'}</button>
  </div>;
}
