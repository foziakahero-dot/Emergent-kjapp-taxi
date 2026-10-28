import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { useAuth } from '@/src/context/AuthContext';
import { storage } from '@/src/utils/storage';
import { BACKEND, TOKEN_KEY, carsApi } from './api';
import { Availability, carExpiry, validPosition, visibleCars } from './carAvailability';
import { LiveCarsFeed, distanceKm, RADIUS_KM, FEED_STALE_MS } from './liveCars';
import { readPickupLocation } from './pickupLocation';

const REST_RECOVERY_MS = 1500;
const REST_STALE_MS = FEED_STALE_MS;

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
    let epoch = 0, restEpoch = 0, disposed = false, restInFlight = false, lastRestAt = 0, lastRestSuccessAt = 0, restRecovery = false;
    let watch: Location.LocationSubscription | undefined;
    let initialRestTimer: ReturnType<typeof setTimeout> | undefined;
    let restRecoveryTimer: ReturnType<typeof setTimeout> | undefined;

    const stopRestRecovery = () => {
      restRecovery = false;
      restEpoch++;
      lastRestSuccessAt = 0;
      clearTimeout(restRecoveryTimer);
      restRecoveryTimer = undefined;
    };

    const publishRestSnapshot = (result: any, receivedAt: number) => {
      if (!Array.isArray(result?.cars)) throw new Error('Invalid availability response');
      const expiresAt: Record<string, number> = {};
      const cars = result.cars.filter((car: any) => {
        if (car?.online === false || car?.available === false || typeof car?.id !== 'string' || car.id === user.id || !validPosition(car)) return false;
        if (!point.current || distanceKm(point.current, car) > RADIUS_KM
          || (filters.current.vehicle_type && car.type !== filters.current.vehicle_type)) return false;
        const expiry = carExpiry(car, result, receivedAt);
        if (expiry <= receivedAt || expiresAt[car.id]) return false;
        expiresAt[car.id] = expiry;
        return true;
      });
      lastRestSuccessAt = receivedAt;
      setState({ cars, expiresAt, phase: cars.length ? 'available' : 'waiting', issue: cars.length ? null : 'empty', attempt: 0, nextAt: null });
    };

    const recoverViaRest = async (force = false) => {
      const p = point.current;
      if (!p || restInFlight || disposed) return;
      const now = Date.now();
      if (!force && now - lastRestAt < REST_RECOVERY_MS) return;
      restInFlight = true; lastRestAt = now;
      const generation = epoch;
      const recoveryGeneration = restEpoch;
      try {
        const result = await carsApi.nearby(p.lat, p.lng, filters.current.vehicle_type, filters.current.special_needs || []);
        if (disposed || generation !== epoch || recoveryGeneration !== restEpoch || !restRecovery || !point.current) return;
        publishRestSnapshot(result, Date.now());
      } catch {
        // Never keep a recovered car marker beyond the backend's realtime
        // freshness window if both socket and REST are unavailable.
        if (!disposed && generation === epoch && recoveryGeneration === restEpoch && restRecovery && lastRestSuccessAt && Date.now() - lastRestSuccessAt >= REST_STALE_MS) {
          setState({ cars: [], expiresAt: {}, phase: 'waiting', issue: 'offline', attempt: 1, nextAt: null });
          lastRestSuccessAt = 0;
        }
      } finally {
        restInFlight = false;
      }
    };

    const scheduleRestRecovery = () => {
      clearTimeout(restRecoveryTimer);
      if (!restRecovery || disposed) return;
      restRecoveryTimer = setTimeout(() => {
        void recoverViaRest(true).finally(() => scheduleRestRecovery());
      }, REST_RECOVERY_MS);
    };

    const startRestRecovery = () => {
      if (restRecovery || disposed || !point.current) return;
      restRecovery = true;
      restEpoch++;
      void recoverViaRest(true).finally(() => scheduleRestRecovery());
    };

    const next = new LiveCarsFeed(() => io(`${BACKEND}/customer-cars`, {
      path: '/socket.io', transports: ['websocket'], autoConnect: false,
      reconnectionDelay: 500, reconnectionDelayMax: 1500, timeout: 2000,
      auth: callback => { void storage.getItem(TOKEN_KEY).then(token => callback({ token })).catch(() => callback({ token: null })); },
    }), snapshot => {
      if (disposed) return;
      if (snapshot.issue === 'offline') {
        setState(snapshot);
        startRestRecovery();
        return;
      }
      // Any authoritative socket snapshot takes back ownership immediately.
      stopRestRecovery();
      setState(snapshot);
    });
    feed.current = next; point.current = null; setState(next.state);

    const setActive = async (active: boolean) => {
      const generation = ++epoch;
      watch?.remove(); watch = undefined; point.current = null;
      clearTimeout(initialRestTimer); initialRestTimer = undefined;
      stopRestRecovery();
      next.setActive(false);
      if (!active || disposed) return;
      // Manual pickup is for booking. Supply is centred on actual customer GPS;
      // this passive check never opens a new OS permission prompt.
      const result = await readPickupLocation(Location, false);
      if (disposed || generation !== epoch) return;
      if (!result.point) { next.locationUnavailable(); return; }
      point.current = result.point;
      next.subscribe({ ...result.point, ...filters.current }); next.setActive(true);
      // Socket.IO remains primary. REST uses the same authoritative backend
      // snapshot if the socket handshake stalls on this device/network.
      initialRestTimer = setTimeout(() => {
        if (!disposed && generation === epoch && next.state.phase === 'loading') startRestRecovery();
      }, 1200);
      try {
        const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 1000 }, position => {
          if (disposed || generation !== epoch) return;
          const p = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (!validPosition(p)) { stopRestRecovery(); next.locationUnavailable(); return; }
          point.current = p; next.subscribe({ ...p, ...filters.current }); next.setActive(true);
        }, () => {
          if (!disposed && generation === epoch) {
            point.current = null; stopRestRecovery(); next.locationUnavailable();
          }
        });
        if (disposed || generation !== epoch) subscription.remove(); else watch = subscription;
      } catch {
        if (!disposed && generation === epoch) { stopRestRecovery(); next.locationUnavailable(); }
      }
    };
    void setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', value => { void setActive(value === 'active'); });
    const timer = setInterval(() => {
      next.tick();
      // REST recovery owns separate state from LiveCarsFeed. Expire it even
      // while the next HTTP request is stalled; a request is not proof of life.
      setState(previous => {
        const cars = visibleCars(previous, Date.now()).filter(car => car.id !== user.id
          && point.current && distanceKm(point.current, car) <= RADIUS_KM
          && (!filters.current.vehicle_type || car.type === filters.current.vehicle_type));
        return cars.length === previous.cars.length ? previous : {
          ...previous, cars, phase: cars.length ? 'available' : 'waiting',
          issue: cars.length ? null : previous.issue || 'empty',
        };
      });
    }, 200);
    return () => {
      disposed = true; epoch++; watch?.remove(); listener.remove(); clearInterval(timer);
      clearTimeout(initialRestTimer); stopRestRecovery();
      next.dispose(); feed.current = null; point.current = null;
    };
  }, [enabled, user?.id, retryVersion, locationRevision]));

  useEffect(() => {
    if (point.current) feed.current?.subscribe({ ...point.current, ...filters.current });
  }, [vehicleType, needsKey]);

  return { ...state, cars: enabled && user?.id ? state.cars : [], center: point.current, now: Date.now(), seconds: null,
    retry: useCallback(() => setRetryVersion(value => value + 1), []) };
}
