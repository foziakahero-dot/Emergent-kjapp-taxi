import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { useAuth } from '@/src/context/AuthContext';
import { storage } from '@/src/utils/storage';
import { BACKEND, TOKEN_KEY } from './api';
import { Availability, validPosition } from './carAvailability';
import { LiveCarsFeed } from './liveCars';
import { readPickupLocation } from './pickupLocation';

export function useAvailableCars({ enabled, vehicleType, specialNeeds = [], locationRevision = 0 }: {
  enabled: boolean; vehicleType?: string; specialNeeds?: string[]; locationRevision?: number;
}) {
  const { user } = useAuth();
  const [state, setState] = useState<Availability>({ cars: [], phase: 'loading', issue: null, attempt: 0, nextAt: null });
  const [retryVersion, setRetryVersion] = useState(0);
  const feed = useRef<LiveCarsFeed | null>(null);
  const point = useRef<{ lat: number; lng: number } | null>(null);
  const needsKey = [...specialNeeds].sort().join(',');
  const filters = useRef({ vehicle_type: vehicleType, special_needs: specialNeeds });
  filters.current = { vehicle_type: vehicleType, special_needs: needsKey ? needsKey.split(',') : [] };
  useFocusEffect(useCallback(() => {
    if (!enabled || !user?.id) return;
    const next = new LiveCarsFeed(() => io(`${BACKEND}/customer-cars`, {
      path: '/socket.io', transports: ['websocket'], autoConnect: false,
      reconnectionDelay: 500, reconnectionDelayMax: 1500, timeout: 2000,
      auth: callback => { void storage.getItem(TOKEN_KEY).then(token => callback({ token })).catch(() => callback({ token: null })); },
    }), setState);
    feed.current = next; point.current = null; setState(next.state);
    let epoch = 0, disposed = false;
    let watch: Location.LocationSubscription | undefined;
    const setActive = async (active: boolean) => {
      const generation = ++epoch;
      watch?.remove(); watch = undefined; point.current = null;
      next.setActive(false);
      if (!active || disposed) return;
      // Manual pickup is for booking. Supply is centred on actual customer GPS;
      // this passive check never opens a new OS permission prompt.
      const result = await readPickupLocation(Location, false);
      if (disposed || generation !== epoch) return;
      if (!result.point) { next.locationUnavailable(); return; }
      point.current = result.point;
      next.subscribe({ ...result.point, ...filters.current }); next.setActive(true);
      try {
        const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 1000 }, position => {
          if (disposed || generation !== epoch) return;
          const p = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (!validPosition(p)) { next.locationUnavailable(); return; }
          point.current = p; next.subscribe({ ...p, ...filters.current }); next.setActive(true);
        }, () => { if (!disposed && generation === epoch) { point.current = null; next.locationUnavailable(); } });
        if (disposed || generation !== epoch) subscription.remove(); else watch = subscription;
      } catch { if (!disposed && generation === epoch) next.locationUnavailable(); }
    };
    void setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', value => { void setActive(value === 'active'); });
    const timer = setInterval(() => next.tick(), 200);
    return () => { disposed = true; epoch++; watch?.remove(); listener.remove(); clearInterval(timer); next.dispose(); feed.current = null; point.current = null; };
  }, [enabled, user?.id, retryVersion, locationRevision]));
  useEffect(() => {
    if (point.current) feed.current?.subscribe({ ...point.current, ...filters.current });
  }, [vehicleType, needsKey]);
  return { ...state, cars: enabled && user?.id ? state.cars : [], center: point.current, now: Date.now(), seconds: null,
    retry: useCallback(() => setRetryVersion(value => value + 1), []) };
}
