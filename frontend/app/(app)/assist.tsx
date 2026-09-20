import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { VehicleAsset, VehicleKind } from '@/src/components/VehicleAsset';
import { aiApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, kr } from '@/src/lib/format';

type Msg = { role: 'user' | 'assistant'; content: string };
type Place = { name: string; lat: number; lng: number };
type Step = 'chat' | 'destination' | 'category' | 'confirm' | 'booking';

const QUICK = ['Bestill taxi', 'Hva koster en tur?', 'Kundeservice'];
const PRIMARY_TYPES: VehicleKind[] = ['ai-first', 'trygg', 'premium'];

function vehicleCopy(type: string) {
  if (type === 'trygg') return { name: 'KJAPP XL', tagline: 'Mer plass · 7 seter' };
  if (type === 'premium') return { name: 'Premium', tagline: 'Executive comfort' };
  return { name: 'KJAPP', tagline: 'Rask og enkel' };
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
    .filter((p: any) => p?.name && Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
    .map((p: any) => ({ name: p.name, lat: Number(p.lat), lng: Number(p.lng) }));
}

export default function Assist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const scroll = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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
    setError('');
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
    if (sending) return;
    setError('');
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
      setSending(false);
    }
  };

  const startBookingTo = async (originalText: string, destinationQuery: string) => {
    if (sending) return;
    setError('');
    setSending(true);
    setResults([]);
    add({ role: 'user', content: originalText });

    if (hasFutureRideTime(originalText)) {
      add({
        role: 'assistant',
        content: 'Planlagte turer er ikke aktivert i KJAPP-backenden ennå. Jeg bestiller derfor ikke denne som en tur nå. Du kan fortsatt be om en bil nå.',
      });
      setSending(false);
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
      setSending(false);
    }
  };

  const searchDestination = async (text: string) => {
    const q = text.trim();
    if (q.length < 2) return;
    setError('');
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
      setSending(false);
    }
  };

  const chooseDestination = async (place: Place) => {
    if (!pickup) return;
    setResults([]);
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
      add({ role: 'assistant', content: `Ruten er ca. ${est.distance_km} km · ${est.duration_min} min. Prisene under kommer fra KJAPP.` });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
      setDropoff(null);
      setStep('destination');
    } finally {
      setSending(false);
    }
  };

  const chooseVehicle = (type: string) => {
    const option = estimate?.options?.find((o: any) => o.vehicle_type === type);
    if (!option) return;
    const copy = vehicleCopy(type);
    setVehicle(type);
    setStep('confirm');
    add({ role: 'user', content: copy.name });
    add({ role: 'assistant', content: `${copy.name} · ${kr(option.price)}. Kontroller turen under og bekreft selv.` });
  };

  const confirm = async () => {
    if (!pickup || !dropoff || !vehicle) return;
    setStep('booking');
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
      });
      router.push(`/booking/${trip.trip_id}`);
    } catch (e: any) {
      if (e?.response?.status === 402) {
        add({ role: 'assistant', content: 'Legg til en verifisert betalingsmåte før turen kan bestilles.' });
        router.push('/payment-methods');
      } else {
        add({ role: 'assistant', content: apiError(e) });
      }
      setStep('confirm');
    } finally {
      setSending(false);
    }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;
    setInput('');

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

    setSending(true);
    setError('');
    add({ role: 'user', content: text });
    try {
      const r = await aiApi.chat(text, sessionId);
      if (r?.session_id) setSessionId(r.session_id);
      add({ role: 'assistant', content: r?.reply || 'Jeg fikk ikke et svar akkurat nå.' });
    } catch (e) {
      add({ role: 'assistant', content: apiError(e) });
    } finally {
      setSending(false);
    }
  };

  const toggleVoice = async () => {
    if (transcribing || sending) return;
    setError('');

    if (recorderState.isRecording) {
      setTranscribing(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('Fant ikke lydopptaket.');
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const lower = uri.toLowerCase();
        const mime = lower.endsWith('.wav') ? 'audio/wav'
          : lower.endsWith('.webm') ? 'audio/webm'
          : lower.endsWith('.mp4') ? 'audio/mp4'
          : 'audio/m4a';
        const r = await aiApi.transcribe(b64, mime, 'no');
        const text = String(r?.text || '').trim();
        if (text) await send(text);
        else setError('Jeg hørte ikke noe tydelig. Prøv igjen.');
      } catch (e) {
        setError(apiError(e));
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Mikrofontilgang må være aktivert for talebestilling.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 15 });
    } catch (e) {
      setError(apiError(e));
    }
  };

  const selectedOption = vehicle ? estimate?.options?.find((o: any) => o.vehicle_type === vehicle) : null;
  const visibleOptions = (estimate?.options || []).filter((o: any) => PRIMARY_TYPES.includes(o.vehicle_type as VehicleKind));
  const voiceLabel = recorderState.isRecording
    ? 'Lytter · trykk for å stoppe'
    : transcribing
      ? 'Tolker tale…'
      : sending
        ? 'Henter sikre data…'
        : step === 'destination'
          ? 'Klar for destinasjon'
          : 'Klar';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
          testID="assist-back"
        >
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>KJAPP ASSIST</Text>
          <Text style={s.title}>Bestill med tale eller tekst</Text>
        </View>
        {step !== 'chat' ? (
          <Pressable
            onPress={() => { resetBooking(); add({ role: 'assistant', content: 'Bestillingen er avbrutt.' }); }}
            style={s.cancel}
            accessibilityRole="button"
          >
            <Text style={s.cancelText}>Avbryt</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.voiceStatus}>
        <View style={[s.voiceDot, recorderState.isRecording && s.voiceDotActive]} />
        <Text style={[s.voiceStatusText, recorderState.isRecording && { color: colors.accent }]}>{voiceLabel}</Text>
        <Text style={s.voicePrivacy}>Pris og ETA kommer alltid fra KJAPP</Text>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled">
        {step === 'chat' && messages.length <= 1 ? (
          <View style={s.voiceIntro}>
            <View style={s.voiceIcon}>
              <Icon name="mic" size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.voiceTitle}>Si hvor du skal</Text>
              <Text style={s.voiceBody}>For eksempel «Kjør meg til Gardermoen». KJAPP bruker posisjonen din som hentested og viser sikre stedstreff før pris og ETA.</Text>
            </View>
          </View>
        ) : null}

        <View style={s.transcript}>
          {messages.map((m, i) => (
            <View key={`${m.role}-${i}`} style={s.transcriptRow}>
              <Text style={[s.transcriptRole, m.role === 'user' && { color: colors.textSecondary }]}>
                {m.role === 'user' ? 'DU' : 'KJAPP'}
              </Text>
              <Text style={s.transcriptText}>{m.content}</Text>
            </View>
          ))}
        </View>

        {step === 'chat' && messages.length <= 1 ? (
          <View style={s.quickWrap}>
            {QUICK.map((q) => (
              <Pressable key={q} style={s.quick} onPress={() => send(q)}>
                <Text style={s.quickText}>{q}</Text>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {results.map((p, i) => (
          <Pressable key={`${p.name}-${i}`} style={s.result} onPress={() => chooseDestination(p)} testID={`assist-place-${i}`}>
            <View style={s.resultIcon}><Icon name="map-pin" size={17} color={colors.accent} /></View>
            <Text style={s.resultText} numberOfLines={2}>{p.name}</Text>
            <Icon name="chevron-right" size={17} color={colors.textMuted} />
          </Pressable>
        ))}

        {step === 'category' && visibleOptions.length ? (
          <View style={s.options}>
            <View style={s.optionHeading}>
              <Text style={s.optionTitle}>Velg bil</Text>
              <Text style={s.optionMeta}>{estimate?.duration_min} min estimert</Text>
            </View>
            {visibleOptions.map((o: any) => {
              const kind = o.vehicle_type as VehicleKind;
              const copy = vehicleCopy(kind);
              return (
                <Pressable
                  key={o.vehicle_type}
                  style={s.vehicle}
                  onPress={() => chooseVehicle(o.vehicle_type)}
                  testID={`assist-vehicle-${o.vehicle_type}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${copy.name}, ${copy.tagline}, ${kr(o.price)}`}
                >
                  <View style={s.vehicleArt}>
                    <VehicleAsset kind={kind} width={104} height={58} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.vehicleName}>{copy.name}</Text>
                    <Text style={s.vehicleSub}>{copy.tagline}</Text>
                  </View>
                  <Text style={s.vehiclePrice}>{kr(o.price)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 'confirm' && selectedOption ? (
          <View style={s.confirmCard}>
            <Text style={s.confirmLabel}>KONTROLLER FØR BESTILLING</Text>
            <Text style={s.confirmRoute} numberOfLines={3}>{pickup?.name} → {dropoff?.name}</Text>
            <View style={s.confirmMeta}>
              <Text style={s.confirmMetaText}>{estimate?.distance_km} km · {estimate?.duration_min} min</Text>
              <Text style={s.confirmPrice}>{kr(selectedOption.price)}</Text>
            </View>
            <Text style={s.confirmHint}>Ingen tur opprettes før du trykker bekreft.</Text>
            <Pressable style={s.confirmBtn} onPress={confirm} disabled={sending} testID="assist-confirm">
              {sending ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.confirmBtnText}>Bekreft KJAPP</Text>}
            </Pressable>
          </View>
        ) : null}

        {sending && step !== 'booking' ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.loadingText}>Henter data…</Text>
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[s.mic, recorderState.isRecording && s.micRecording]}
          onPress={toggleVoice}
          disabled={transcribing}
          testID="assist-mic"
          accessibilityRole="button"
          accessibilityLabel={recorderState.isRecording ? 'Stopp taleopptak' : 'Start taleopptak'}
        >
          {transcribing
            ? <ActivityIndicator color={colors.accent} />
            : <Icon name="mic" size={20} color={recorderState.isRecording ? colors.accentOn : colors.accent} />}
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={step === 'destination' ? 'Hvor skal du?' : 'Kjør meg til…'}
          placeholderTextColor={colors.textMuted}
          style={s.input}
          returnKeyType="send"
          onSubmitEditing={() => send()}
          editable={!sending && !transcribing && step !== 'category' && step !== 'confirm' && step !== 'booking'}
          testID="assist-input"
        />
        <Pressable
          style={[s.send, (!input.trim() || sending || transcribing) && s.sendDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || sending || transcribing}
          testID="assist-send"
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Icon name="navigation" size={18} color={colors.accentOn} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: c.line,
  },
  back: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line,
  },
  eyebrow: { color: c.accent, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.5 },
  title: { color: c.text, fontFamily: font.display, fontSize: 18, marginTop: 2 },
  cancel: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.line },
  cancelText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 12 },
  voiceStatus: {
    minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 8,
    backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line,
  },
  voiceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.textMuted },
  voiceDotActive: { backgroundColor: c.accent },
  voiceStatusText: { color: c.textSecondary, fontSize: 11, fontFamily: font.medium },
  voicePrivacy: { color: c.textMuted, fontSize: 10, marginLeft: 'auto' },
  messages: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 12 },
  voiceIntro: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.cardSubtle,
    borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 15,
  },
  voiceIcon: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.accentSoft, borderWidth: 1, borderColor: 'rgba(0,229,245,0.22)',
  },
  voiceTitle: { color: c.text, fontFamily: font.display, fontSize: 16 },
  voiceBody: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  transcript: { gap: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  transcriptRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line },
  transcriptRole: { width: 42, color: c.accent, fontFamily: font.bold, fontSize: 9, letterSpacing: 1.2, paddingTop: 2 },
  transcriptText: { color: c.text, fontSize: 13, lineHeight: 19, flex: 1 },
  quickWrap: { gap: 8 },
  quick: {
    minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, paddingHorizontal: 15, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line,
  },
  quickText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 13 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 13, minHeight: 62 },
  resultIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: c.text, fontSize: 13, flex: 1 },
  options: { gap: 9 },
  optionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 2 },
  optionTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  optionMeta: { color: c.textMuted, fontSize: 11 },
  vehicle: {
    minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  vehicleArt: { width: 108, height: 62, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  vehicleSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  vehiclePrice: { color: c.accent, fontFamily: font.mono, fontSize: 14 },
  confirmCard: { backgroundColor: c.card, borderWidth: 1, borderColor: 'rgba(0,229,245,0.40)', borderRadius: 18, padding: 16 },
  confirmLabel: { color: c.accent, fontFamily: font.bold, fontSize: 9, letterSpacing: 1.6 },
  confirmRoute: { color: c.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20, marginTop: 10 },
  confirmMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  confirmMetaText: { color: c.textMuted, fontSize: 12 },
  confirmPrice: { color: c.text, fontFamily: font.mono, fontSize: 23 },
  confirmHint: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  confirmBtn: { height: 54, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  confirmBtnText: { color: c.accentOn, fontFamily: font.bold, fontSize: 15 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12 },
  loadingText: { color: c.textMuted, fontSize: 12 },
  error: { color: c.danger, fontSize: 12, paddingHorizontal: 18, paddingVertical: 7, backgroundColor: c.dangerSoft },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface,
  },
  mic: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  micRecording: { backgroundColor: c.accent, borderColor: c.accent },
  input: { flex: 1, height: 48, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingHorizontal: 15, color: c.text, fontFamily: font.body, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.45 },
}));