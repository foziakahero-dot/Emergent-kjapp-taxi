import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { useAccessibilityPreferences } from '@/src/lib/accessibilityPreferences';
import { driverPresence } from '@/src/lib/tripPresence';

/** Opt-in reading of actual trip status, fresh pickup ETA and assigned plate. */
export function useTripSpeech(trip: any, offline: boolean) {
  const { voiceSupport } = useAccessibilityPreferences();
  const previous = useRef('');
  const labels: Record<string, string> = { searching: 'Søker sjåfør.', booking: 'Bestiller tur.', driver_on_way: 'Sjåføren er på vei.', at_pickup: 'Sjåføren er fremme.', in_trip: 'Turen pågår.' };
  const fresh = driverPresence(trip).fresh;
  const eta = trip?.status === 'driver_on_way' && fresh && typeof trip.eta_min === 'number' && Number.isFinite(trip.eta_min) && trip.eta_min > 0 ? Math.ceil(trip.eta_min) : null;
  const plate = typeof trip?.driver?.plate === 'string' && trip.driver_id ? trip.driver.plate : '';
  const message = !offline && labels[trip?.status] ? [labels[trip.status], eta ? `Ankomst om omtrent ${eta} minutter.` : '', plate ? `Bilnummer ${plate}.` : ''].filter(Boolean).join(' ') : '';
  useEffect(() => {
    if (!voiceSupport || !message) { previous.current = ''; return; }
    const key = `${trip?.trip_id}:${message}`;
    if (previous.current === key) return;
    previous.current = key;
    let active = true;
    void Speech.stop().then(() => { if (active) Speech.speak(message, { language: 'nb-NO', rate: .9 }); }).catch(() => {});
    return () => { active = false; void Speech.stop().catch(() => {}); };
  }, [voiceSupport, message, trip?.trip_id]);
}
