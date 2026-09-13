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
import { aiApi, placesApi, tripsApi } from '@/src/lib/api';
import { apiError, kr, VEHICLES } from '@/src/lib/format';

type Msg = { role: 'user' | 'assistant'; content: string };
type Place = { name: string; lat: number; lng: number };
type Step = 'chat' | 'destination' | 'category' | 'confirm' | 'booking';

const QUICK = ['Bestill taxi', 'Hva koster en tur?', 'Hvordan fungerer KJAPP?'];

export default function Assist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStyles();
  const scroll = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Hei! Jeg er KJAPP Assist. Jeg kan hjelpe deg eller bestille en ekte tur.' },
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
  };

  const startBooking = async () => {
    if (sending) return;
    setError('');
    setSending(true);
    setResults([]);
    add({ role: 'user', content: 'Bestill taxi' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        add({ role: 'assistant', content: 'Jeg trenger posisjonen din for å bruke nåværende sted som hentepunkt. Du kan slå på posisjon og prøve igjen.' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let name = 'Din posisjon';
      try {
        const rev = await placesApi.reverse(lat, lng);
        name = rev?.label || rev?.name || name;
      } catch {}
      setPickup({ name, lat, lng });
      setStep('destination');
      add({ role: 'assistant', content: `Jeg henter deg ved ${name}. Hvor skal du? Skriv eller si destinasjonen.` });
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
      const raw = r?.results || [];
      const places: Place[] = raw
        .filter((p: any) => p?.name && Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => ({ name: p.name, lat: Number(p.lat), lng: Number(p.lng) }));
      setResults(places);
      if (!places.length) add({ role: 'assistant', content: 'Jeg fant ingen sikre treff. Prøv gatenavn, sted eller adresse på nytt.' });
      else add({ role: 'assistant', content: 'Velg riktig destinasjon:' });
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
      add({ role: 'assistant', content: `Turen er ca. ${est.distance_km} km og ${est.duration_min} min. Velg bilkategori.` });
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
    const meta = VEHICLES.find((v) => v.type === type);
    setVehicle(type);
    setStep('confirm');
    add({ role: 'user', content: meta?.name || type });
    add({ role: 'assistant', content: `${meta?.name || 'KJAPP'} koster ${kr(option.price)}. Bekreft bestillingen når du er klar.` });
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
      add({ role: 'assistant', content: 'Bestillingen er bekreftet. Jeg åpner turen din nå.' });
      router.push(`/booking/${trip.trip_id}`);
    } catch (e: any) {
      if (e?.response?.status === 402) {
        add({ role: 'assistant', content: 'Du må legge til en verifisert betalingsmåte før turen kan bestilles.' });
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
    if (/bestill|book|taxi|hent meg|reise/i.test(text) && step === 'chat') {
      await startBooking();
      return;
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.aiOrb}><Icon name="sparkles" size={19} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>KJAPP Assist</Text>
          <Text style={s.status}>● Klar for chat og bestilling</Text>
        </View>
        {step !== 'chat' ? (
          <Pressable onPress={() => { resetBooking(); add({ role: 'assistant', content: 'Bestillingen er avbrutt.' }); }} style={s.cancel}>
            <Text style={s.cancelText}>Avbryt</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled">
        {messages.map((m, i) => (
          <View key={`${m.role}-${i}`} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
            <Text style={[s.bubbleText, m.role === 'user' && s.userText]}>{m.content}</Text>
          </View>
        ))}

        {step === 'chat' && messages.length <= 1 ? (
          <View style={s.quickWrap}>
            {QUICK.map((q) => (
              <Pressable key={q} style={s.quick} onPress={() => send(q)}>
                <Text style={s.quickText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {results.map((p, i) => (
          <Pressable key={`${p.name}-${i}`} style={s.result} onPress={() => chooseDestination(p)} testID={`assist-place-${i}`}>
            <View style={s.resultIcon}><Icon name="map-pin" size={16} color={colors.accent} /></View>
            <Text style={s.resultText} numberOfLines={2}>{p.name}</Text>
            <Icon name="chevron-right" size={17} color={colors.textMuted} />
          </Pressable>
        ))}

        {step === 'category' && estimate?.options ? (
          <View style={s.options}>
            {estimate.options.map((o: any) => {
              const meta = VEHICLES.find((v) => v.type === o.vehicle_type);
              return (
                <Pressable key={o.vehicle_type} style={s.vehicle} onPress={() => chooseVehicle(o.vehicle_type)} testID={`assist-vehicle-${o.vehicle_type}`}>
                  <View style={s.vehicleIcon}><Icon name="car" size={18} color={colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.vehicleName}>{meta?.name || o.vehicle_type}</Text>
                    <Text style={s.vehicleSub}>{meta?.tagline || ''}</Text>
                  </View>
                  <Text style={s.vehiclePrice}>{kr(o.price)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 'confirm' && selectedOption ? (
          <View style={s.confirmCard}>
            <Text style={s.confirmLabel}>KLAR TIL BESTILLING</Text>
            <Text style={s.confirmRoute} numberOfLines={2}>{pickup?.name} → {dropoff?.name}</Text>
            <View style={s.confirmMeta}>
              <Text style={s.confirmMetaText}>{estimate?.distance_km} km · {estimate?.duration_min} min</Text>
              <Text style={s.confirmPrice}>{kr(selectedOption.price)}</Text>
            </View>
            <Pressable style={s.confirmBtn} onPress={confirm} disabled={sending} testID="assist-confirm">
              {sending ? <ActivityIndicator color={colors.accentOn} /> : <Text style={s.confirmBtnText}>Bekreft og bestill</Text>}
            </Pressable>
          </View>
        ) : null}

        {sending && step !== 'booking' ? (
          <View style={[s.bubble, s.aiBubble, { width: 74 }]}><ActivityIndicator color={colors.accent} /></View>
        ) : null}
      </ScrollView>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          style={[s.mic, recorderState.isRecording && s.micRecording]}
          onPress={toggleVoice}
          disabled={transcribing}
          testID="assist-mic"
        >
          {transcribing ? <ActivityIndicator color={colors.accent} /> : <Icon name="phone" size={18} color={recorderState.isRecording ? colors.accentOn : colors.accent} />}
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={step === 'destination' ? 'Skriv destinasjon…' : 'Spør eller bestill…'}
          placeholderTextColor={colors.textMuted}
          style={s.input}
          returnKeyType="send"
          onSubmitEditing={() => send()}
          editable={!sending && !transcribing && step !== 'category' && step !== 'confirm' && step !== 'booking'}
          testID="assist-input"
        />
        <Pressable style={s.send} onPress={() => send()} disabled={!input.trim() || sending || transcribing} testID="assist-send">
          <Icon name="navigation" size={18} color={colors.accentOn} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  aiOrb: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.accent },
  title: { color: c.text, fontFamily: font.display, fontSize: 19 },
  status: { color: c.online, fontSize: 11, marginTop: 2 },
  cancel: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.line },
  cancelText: { color: c.textSecondary, fontSize: 12 },
  messages: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20, gap: 10 },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 5 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: c.accent, borderBottomRightRadius: 5 },
  bubbleText: { color: c.text, fontSize: 14, lineHeight: 20 },
  userText: { color: c.accentOn, fontWeight: '600' },
  quickWrap: { gap: 8, marginTop: 10 },
  quick: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  quickText: { color: c.textSecondary, fontSize: 13 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 13 },
  resultIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: c.text, fontSize: 13, flex: 1 },
  options: { gap: 9 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 13 },
  vehicleIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { color: c.text, fontSize: 14, fontWeight: '700' },
  vehicleSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  vehiclePrice: { color: c.accent, fontFamily: font.mono, fontSize: 15 },
  confirmCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.accent, borderRadius: 20, padding: 16 },
  confirmLabel: { color: c.accent, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  confirmRoute: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 10 },
  confirmMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  confirmMetaText: { color: c.textMuted, fontSize: 12 },
  confirmPrice: { color: c.accent, fontFamily: font.display, fontSize: 24 },
  confirmBtn: { height: 50, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  confirmBtnText: { color: c.accentOn, fontWeight: '800', fontSize: 15 },
  error: { color: c.danger, fontSize: 12, paddingHorizontal: 18, paddingVertical: 6 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  micRecording: { backgroundColor: c.accent, borderColor: c.accent },
  input: { flex: 1, height: 46, borderRadius: 23, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, color: c.text, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
}));
