import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { carsApi } from './api';
import { Availability, CarAvailabilitySearch, visibleCars } from './carAvailability';

export function useAvailableCars({ enabled, lat, lng, vehicleType, specialNeeds = [], continuous = false }: {
  enabled: boolean; lat?: number; lng?: number; vehicleType?: string; specialNeeds?: string[]; continuous?: boolean;
}) {
  const [state, setState] = useState<Availability>({ cars: [], phase: 'loading', issue: null, attempt: 0, nextAt: null });
  const [now, setNow] = useState(Date.now());
  const search = useRef<CarAvailabilitySearch | null>(null);
  const needsKey = [...specialNeeds].sort().join(',');
  useFocusEffect(useCallback(() => {
    if (!enabled || lat == null || lng == null) { setState({ cars: [], phase: 'loading', issue: null, attempt: 0, nextAt: null }); return; }
    const next = new CarAvailabilitySearch(() => carsApi.nearby(lat, lng, vehicleType, needsKey ? needsKey.split(',') : []), state => { setNow(Date.now()); setState(state); }, continuous);
    search.current = next;
    setState(next.state);
    next.setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', value => next.setActive(value === 'active'));
    return () => { next.dispose(); listener.remove(); search.current = null; };
  }, [enabled, lat, lng, vehicleType, needsKey, continuous]));
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') setNow(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  const cars = visibleCars(state, now);
  return { ...state, cars, phase: state.phase === 'available' && !cars.length ? 'waiting' as const : state.phase,
    issue: state.phase === 'available' && !cars.length ? 'empty' as const : state.issue,
    now, seconds: state.nextAt ? Math.max(0, Math.ceil((state.nextAt - now) / 1000)) : null,
    retry: useCallback(() => search.current?.retry(), []) };
}
