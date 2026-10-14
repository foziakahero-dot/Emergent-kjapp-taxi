import { CustomerAssistView } from '@/src/components/CustomerAssistView';
import { confirmedPaymentMethod } from '@/src/components/CustomerBookingView';
import { useHideTabBar } from '@/src/components/FloatingTabBar';
import { useAuth } from '@/src/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { type VehicleKind } from '@/src/components/VehicleAsset';
import { aiApi, paymentApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';

type Msg = { role: 'user' | 'assistant'; content: string };
type Place = { name: string; lat: number; lng: number };
type Step = 'chat' | 'destination' | 'category' | 'confirm' | 'booking';

const PRIMARY_TYPES: VehicleKind[] = ['ai-first', 'trygg', 'premium'];

function vehicleCopy(type: string) {
  if (type === 'trygg') return { name: 'SNAR XL', tagline: 'Mer plass' };
  if (type === 'premium') return { name: 'Premium', tagline: 'Executive comfort' };
  return { name: 'SNAR', tagline: 'Rask og enkel' };
}

function hasFutureRideTime(text: string) {
  return /\b(?:kl(?:\.|okken)?\s*\d{1,2}(?:[:.]\d{2})?|i\s+morgen|imorgen|senere|på\s+(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag))\b/i.test(text);
}

function bookingDestinationFrom(text: string): string | null {
  if (!/(?:taxi|kjør|kjor|hent|bestill|book|reise)/i.test(text)) return null;
  const match = text.match(/\b(?:til|mot)\s+(.+)$/i);
  if (!match?.[1]) return null;
  const destination = match[1]
    .replace(/\s+\b(?:kl(?:\.|okken)?\s*\d{1,2}(?:[:.]\d{2})?|i\s+morgen|imorgen|senere)\b.*$/i, '')
    .trim();
  return destination.length >= 2 ? destination : null;
}

function normalizePlaces(raw: any[]): Place[] {
  return (raw || [])
    .filter((p: any) => typeof p?.name === 'string' && p.name.trim() && [p.lat, p.lng].every(value => typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0)) && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Math.abs(Number(p.lat)) <= 90 && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lng)) <= 180)
    .map((p: any) => ({ name: p.name, lat: Number(p.lat), lng: Number(p.lng) }));
}

export default function Assist() {
  const router = useRouter();
  const { user } = useAuth();
  const bookingLock = useRef(false), requestLock = useRef(false), voiceLock = useRef(false), voiceSession = useRef(false), wasRecording = useRef(false), voiceGeneration = useRef(0), alive = useRef(true);
  const [voiceOpen, setVoiceOpen] = useState(false), [waitingAccepted, setWaitingAccepted] = useState(false);
  useHideTabBar(voiceOpen);
  const { data: methodsData, isError: methodsError, refetch: refreshMethods } = useQuery({ queryKey: ['assist-payment-methods', user?.id], queryFn: paymentApi.list, enabled: !!user?.id });
  useFocusEffect(useCallback(() => { if (user?.id) void refreshMethods(); }, [user?.id, refreshMethods]));
  const scroll = useRef<ScrollView>(null);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder);
  useEffect(() => { alive.current = true; return () => { alive.current = false; voiceGeneration.current++; voiceSession.current = false; try { void recorder.stop().catch(() => {}); } catch {} void setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }; }, [recorder]);

  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Si for eksempel «Kjør meg til Gardermoen», eller start en vanlig bestilling.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [step, setStep] = useState<Step>('chat');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, results, estimate, step, sending, transcribing]);

  const add = (message: Msg) => setMessages((m) => [...m, message]);

  const resetBooking = () => {
    setStep('chat');
    setPickup(null);
    setDropoff(null);
    setEstimate(null);
    setVehicle(null);
    setResults([]);
    setError(''); setWaitingAccepted(false);
  };

  const resolvePickup = async (): Promise<Place | null> => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      add({ role: 'assistant', content: 'Posisjon er nødvendig for å bruke nåværende sted som hentepunkt. Slå på posisjon og prøv igjen.' });
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let name = 'Din posisjon';
    try {
      const rev = await placesApi.reverse(lat, lng);
      name = rev?.label || rev?.name || name;
    } catch {}
    const place = { name, lat, lng };
    setPickup(place);
    return place;
  };

  const startBooking = async () => {
    if (sending || requestLock.current) return;
    requestLock.current = true; setError('');
    setSending(true);
    setResults([]);
    add({ role: 'user', content: 'Bestill taxi' });
    try {
      const pickupPlace = await resolvePickup();
      if (!pickupPlace) return;
      setStep('destination');
      add({ role: 'assistant', content: `Hentested: ${pickupPlace.name}. Skriv eller si hvor du skal.` });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
      resetBooking();
    } finally {
      requestLock.current = false; setSending(false);
    }
  };

  const startBookingTo = async (originalText: string, destinationQuery: string) => {
    if (sending || requestLock.current) return;
    requestLock.current = true; setError('');
    setSending(true);
    setResults([]);
    add({ role: 'user', content: originalText });

    if (hasFutureRideTime(originalText)) {
      add({
        role: 'assistant',
        content: 'Planlagte turer er ikke aktivert i SNAR-backenden ennå. Jeg bestiller derfor ikke denne som en tur nå. Du kan fortsatt be om en bil nå.',
      });
      requestLock.current = false; setSending(false);
      return;
    }

    try {
      const pickupPlace = await resolvePickup();
      if (!pickupPlace) return;
      setStep('destination');

      const r = await placesApi.search(destinationQuery);
      const places = normalizePlaces(r?.results || []);
      setResults(places);
      if (!places.length) {
        add({ role: 'assistant', content: `Jeg fant ikke et sikkert treff for «${destinationQuery}». Prøv et mer presist sted eller adresse.` });
      } else {
        add({ role: 'assistant', content: `Hentested: ${pickupPlace.name}. Velg riktig «${destinationQuery}»-treff, så henter jeg ekte pris og ETA.` });
      }
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
      resetBooking();
    } finally {
      requestLock.current = false; setSending(false);
    }
  };

  const searchDestination = async (text: string) => {
    const q = text.trim();
    if (q.length < 2 || requestLock.current) return;
    requestLock.current = true; setError('');
    setSending(true);
    setResults([]);
    add({ role: 'user', content: q });
    try {
      const r = await placesApi.search(q);
      const places = normalizePlaces(r?.results || []);
      setResults(places);
      if (!places.length) add({ role: 'assistant', content: 'Ingen sikre treff. Prøv et mer presist gatenavn eller sted.' });
      else add({ role: 'assistant', content: 'Velg riktig sted før jeg henter pris og ETA.' });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
    } finally {
      requestLock.current = false; setSending(false);
    }
  };

  const chooseDestination = async (place: Place) => {
    if (!pickup || requestLock.current) return;
    requestLock.current = true; setResults([]);
    setDropoff(place);
    setSending(true);
    add({ role: 'user', content: `Til ${place.name}` });
    try {
      const est = await tripsApi.estimate({
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: place.lat,
        dropoff_lng: place.lng,
      });
      setEstimate(est);
      setStep('category');
      add({ role: 'assistant', content: `Ruten er ca. ${est.distance_km} km · ${est.duration_min} min. Prisene under kommer fra SNAR.` });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
      setDropoff(null);
      setStep('destination');
    } finally {
      requestLock.current = false; setSending(false);
    }
  };

  const chooseVehicle = (type: string) => {
    const option = estimate?.options?.find((o: any) => o.vehicle_type === type);
    if (!option) return;
    const copy = vehicleCopy(type);
    setVehicle(type); setWaitingAccepted(false);
    setStep('confirm');
    add({ role: 'user', content: copy.name });
    add({ role: 'assistant', content: `${copy.name} · ${kr(option.price)}. Kontroller turen under og bekreft selv.` });
  };

  const confirm = async () => {
    if (!pickup || !dropoff || !vehicle || bookingLock.current || sending) return;
    if (!selectedOption || !Number.isFinite(selectedOption.price) || selectedOption.price <= 0) { setError('Prisen må hentes på nytt før bestilling.'); return; }
    if (!payMethod) { setError('Legg til og verifiser et betalingskort før bestilling.'); router.push('/payment-methods'); return; }
    if (selectedOption.waiting_policy && !waitingAccepted) { setError('Bekreft ventetid og kortreservasjon først.'); return; }
    bookingLock.current = true; setStep('booking');
    setSending(true);
    setError('');
    try {
      const trip = await tripsApi.request({
        pickup_address: pickup.name,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_type: vehicle,
        ...(selectedOption.waiting_policy ? { waiting_policy_token: selectedOption.waiting_policy.token, quoted_price: selectedOption.price, quoted_pricing_version: estimate.pricing_version } : {}),
      });
      router.push(`/booking/${trip.trip_id}`);
    } catch (e: any) {
      const active = await tripsApi.active().catch(() => null);
      if (active?.trip_id) { router.replace(`/booking/${active.trip_id}`); return; }
      if (e?.response?.data?.detail?.code === 'quote_changed') {
        setWaitingAccepted(false); setVehicle(null); setStep('category');
        const fresh = await tripsApi.estimate({ pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng }).catch(() => null);
        setEstimate(fresh); setError('Prisen er endret. Velg bil og bekreft det nye tilbudet.');
      } else {
        if (e?.response?.status === 402) { setError('Legg til en verifisert betalingsmåte før turen kan bestilles.'); router.push('/payment-methods'); }
        else setError(apiError(e));
        setStep('confirm');
      }
    } finally { bookingLock.current = false; setSending(false); }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || requestLock.current) return;
    setInput('');
    if (hasFutureRideTime(text) && (step !== 'chat' || /bestill|book|taxi|kjør|kjor|hent|reise/i.test(text))) {
      add({ role: 'user', content: text });
      add({ role: 'assistant', content: 'Planlagte turer er ikke aktivert i SNAR-backenden ennå. Velg en vanlig bestilling for en bil nå.' });
      return;
    }

    if (step === 'destination') {
      await searchDestination(text);
      return;
    }

    if (step === 'chat') {
      const destinationIntent = bookingDestinationFrom(text);
      if (destinationIntent) {
        await startBookingTo(text, destinationIntent);
        return;
      }
      if (/bestill|book|taxi|hent meg|reise/i.test(text)) {
        await startBooking();
        return;
      }
    }

    requestLock.current = true; setSending(true);
    setError('');
    add({ role: 'user', content: text });
    try {
      const r = await aiApi.chat(text, sessionId);
      if (r?.session_id) setSessionId(r.session_id);
      add({ role: 'assistant', content: r?.reply || 'Jeg fikk ikke et svar akkurat nå.' });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
    } finally {
      requestLock.current = false; setSending(false);
    }
  };

  const processVoice = async (stop = true) => {
    if (voiceLock.current || !voiceSession.current) return;
    const sequence = voiceGeneration.current;
    voiceLock.current = true; voiceSession.current = false; setTranscribing(true);
    try {
      if (stop) await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Fant ikke lydopptaket.');
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!alive.current || sequence !== voiceGeneration.current) return;
      const lower = uri.toLowerCase();
      const mime = lower.endsWith('.wav') ? 'audio/wav' : lower.endsWith('.webm') ? 'audio/webm' : lower.endsWith('.mp4') ? 'audio/mp4' : 'audio/m4a';
      const response = await aiApi.transcribe(b64, mime, 'no');
      if (!alive.current || sequence !== voiceGeneration.current) return;
      const text = String(response?.text || '').trim();
      if (text) await send(text); else setError('Jeg hørte ikke noe tydelig. Prøv igjen.');
    } catch (error) { if (alive.current && sequence === voiceGeneration.current) setError(apiError(error)); }
    finally { voiceLock.current = false; if (alive.current) setTranscribing(false); await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }
  };
  const toggleVoice = async () => {
    setVoiceOpen(true);
    if (transcribing || sending || voiceLock.current) return;
    setError('');
    if (recorderState.isRecording) { await processVoice(); return; }
    const sequence = ++voiceGeneration.current;
    voiceLock.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!alive.current || sequence !== voiceGeneration.current) return;
      if (!permission.granted) { setError('Mikrofontilgang må være aktivert for talebestilling.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (!alive.current || sequence !== voiceGeneration.current) { await setAudioModeAsync({ allowsRecording: false }); return; }
      voiceSession.current = true; recorder.record({ forDuration: 15 });
    } catch (error) {
      voiceSession.current = false;
      if (alive.current && sequence === voiceGeneration.current) setError(apiError(error));
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    finally { voiceLock.current = false; }
  };
  useEffect(() => {
    const finished = wasRecording.current && !recorderState.isRecording;
    wasRecording.current = recorderState.isRecording;
    if (finished && voiceSession.current && !voiceLock.current) void processVoice(false);
  }, [recorderState.isRecording]);
  const closeVoice = async () => {
    voiceGeneration.current++; voiceSession.current = false; wasRecording.current = false;
    if (recorderState.isRecording) await recorder.stop().catch(() => {});
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setVoiceOpen(false);
  };

  const selectedOption = vehicle ? estimate?.options?.find((o: any) => o.vehicle_type === vehicle) : null;
  const visibleOptions = (estimate?.options || []).filter((o: any) => PRIMARY_TYPES.includes(o.vehicle_type as VehicleKind));
  const methods = Array.isArray(methodsData) ? methodsData : (methodsData?.payment_methods || methodsData?.methods || []);
  const payMethod = methodsError ? null : confirmedPaymentMethod(methods);
  return <CustomerAssistView messages={messages} input={input} onInput={setInput} step={step} busy={sending} transcribing={transcribing} recording={recorderState.isRecording} metering={recorderState.metering} voiceOpen={voiceOpen} pickup={pickup} dropoff={dropoff} estimate={estimate} options={visibleOptions} selected={selectedOption} payment={payMethod} consent={waitingAccepted} onConsent={() => setWaitingAccepted(value => !value)} error={error} results={results} scrollRef={scroll} onBack={() => router.back()} onCancel={() => { resetBooking(); add({ role: 'assistant', content: 'Bestillingen er avbrutt.' }); }} onSend={text => void send(text)} onVoice={() => void toggleVoice()} onCloseVoice={() => void closeVoice()} onPlace={place => void chooseDestination(place)} onVehicle={chooseVehicle} onConfirm={() => void confirm()} onPayment={() => router.push('/payment-methods')} />;
}
