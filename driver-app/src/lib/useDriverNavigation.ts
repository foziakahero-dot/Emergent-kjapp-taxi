import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Location from 'expo-location';
import { startDriverBackgroundLocation } from './nativeRuntime';
import { navigationTarget } from './navigationTarget';

type State = { active: boolean; loading: boolean; instruction: string; error: string;
  coordinates: number[][] | null; distanceRemaining?: number; durationRemaining?: number; muted: boolean };
const empty: State = { active: false, loading: false, instruction: '', error: '', coordinates: null, muted: false };
type Event = { sessionId: string; coordinates?: number[][]; instruction?: string;
  distanceRemaining?: number; durationRemaining?: number; message?: string };
type Bridge = { start(id: string, token: string, coordinates: number[][]): Promise<void>;
  stop(): Promise<void>; setMuted(value: boolean): Promise<void>;
  addListener(name: string, listener: (event: Event) => void): { remove(): void } };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Bridge>('SnarNavigation') : null;

export function useDriverNavigation(trip: any) {
  const target = navigationTarget(trip);
  const [state, setState] = useState<State>(empty);
  const session = useRef('');
  const starting = useRef(false);
  const latestTarget = useRef(target?.key);
  latestTarget.current = target?.key;
  const stop = async () => {
    session.current = ''; starting.current = false;
    setState(empty);
    await native?.stop().catch(() => {});
  };
  useEffect(() => {
    if (!native) return;
    const receive = (patch: (event: Event) => Partial<State>) => (event: Event) => {
      if (event.sessionId !== session.current || !session.current) return;
      setState(old => ({ ...old, ...patch(event) }));
    };
    const listeners = [
      native.addListener('onRoute', receive(e => ({ coordinates: e.coordinates || null, loading: false, error: '' }))),
      native.addListener('onProgress', receive(e => ({ distanceRemaining: e.distanceRemaining, durationRemaining: e.durationRemaining }))),
      native.addListener('onInstruction', receive(e => ({ instruction: e.instruction || '' }))),
      native.addListener('onError', receive(e => ({ loading: false, error: e.message || 'Navigasjon er utilgjengelig.' }))),
    ];
    return () => { session.current = ''; starting.current = false; listeners.forEach(l => l.remove()); void native.stop().catch(() => {}); };
  }, []);
  useEffect(() => {
    void stop();
    // Changing pickup/destination/trip invalidates all late native responses.
  }, [target?.key]);
  useEffect(() => {
    if (!state.loading) return;
    const id = session.current;
    const timer = setTimeout(() => {
      if (session.current === id) setState(old => ({ ...old, loading: false,
        error: 'Ruten tar for lang tid. Gå tilbake og prøv igjen, eller bruk Google Maps / Waze.' }));
    }, 20000);
    return () => clearTimeout(timer);
  }, [state.loading]);

  const start = async () => {
    if (starting.current || session.current) return;
    if (!native) throw new Error('Innebygd navigasjon krever den nye Android-versjonen. Bruk Google Maps eller Waze som reserve.');
    if (!target) throw new Error('Turen mangler gyldige navigasjonspunkter.');
    starting.current = true;
    const key = target.key;
    try {
      const permission = await startDriverBackgroundLocation('active');
      if (!permission.foreground || !permission.background) throw new Error('Tillat nøyaktig posisjon hele tiden i Android-innstillingene før du navigerer.');
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      if (Date.now() - fix.timestamp > 15000) throw new Error('Venter på fersk GPS-posisjon. Prøv igjen.');
      if (latestTarget.current !== key || !starting.current) return;
      session.current = `${key}:${Date.now()}`;
      setState({ ...empty, active: true, loading: true });
      await native.start(session.current, (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim(),
        [[fix.coords.longitude, fix.coords.latitude], ...target.coordinates]);
    } catch (e) {
      session.current = '';
      await native.stop().catch(() => {});
      setState(empty);
      throw e;
    } finally { starting.current = false; }
  };
  return { ...state, supported: !!native, start, stop,
    toggleMuted: async () => {
      const muted = !state.muted;
      await native?.setMuted(muted);
      setState(old => ({ ...old, muted }));
    } };
}
