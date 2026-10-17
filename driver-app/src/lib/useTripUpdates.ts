import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { BACKEND, TOKEN_KEY } from './api';
import { storage } from '@/src/utils/storage';

/** Events only invalidate: REST remains the authority for status and identity. */
export function useTripUpdates(tripId: string | undefined, refresh: () => void) {
  const callback = useRef(refresh); callback.current = refresh;
  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    const socket = io(`${BACKEND}/trip-status`, { path: '/socket.io', transports: ['websocket'], autoConnect: false,
      auth: async done => {
        try { done({ token: await storage.getItem(TOKEN_KEY) }); }
        catch { done({ token: null }); }
      }, reconnectionDelay: 500, reconnectionDelayMax: 5000 });
    socket.on('connect', () => { if (alive) socket.emit('trip:subscribe', { trip_id: tripId }); });
    socket.on('trip:changed', event => { if (alive && event?.trip_id === tripId) callback.current(); });
    socket.on('connect_error', () => {}); // Existing REST polling remains active.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') socket.connect();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { socket.connect(); callback.current(); } else socket.disconnect();
    });
    return () => { alive = false; listener.remove(); socket.removeAllListeners(); socket.disconnect(); };
  }, [tripId]);
}
