import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import * as Haptics from 'expo-haptics';
import { V10Entrance } from '@/src/components/V10Entrance';
import { messagesApi, tripsApi, tripDriverPhotoSource } from '@/src/lib/api';
import { Text, TextInput } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Header, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { colors, font, useColorTheme } from '@/src/theme';

const chatStatuses = new Set(['driver_on_way', 'at_pickup', 'in_trip']);
export default function CustomerMessages() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const active = useQuery({ queryKey: ['customer-active-trip', user?.id], queryFn: tripsApi.active, enabled: focused && !!user?.id, refetchInterval: focused ? 2500 : false, retry: 1 });
  const trip = active.data;
  if (!active.isError && trip?.trip_id && trip?.driver_id && chatStatuses.has(trip.status)) return <Conversation key={trip.trip_id} trip={trip} focused={focused} />;
  return <V10Screen dock testID="customer-messages-screen"><V10Header title="Meldinger" />
    <View style={{ marginTop: 24 }}>{active.isPending ? <Loader label="Henter reisestatus…" /> : active.isError ? <V10State icon="wifiOff" warning title="Kunne ikke hente reisestatus" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void active.refetch()} /> : <V10State icon="message" title="Ingen aktive samtaler" body={trip && ['searching', 'booking', 'payment_authorizing'].includes(trip.status) ? 'Samtalen blir tilgjengelig når en sjåfør er tildelt turen din.' : 'Når en sjåfør er tildelt din aktive tur, vises samtalen her.'} action="Til hjem" onAction={() => router.navigate('/(app)/home')} />}</View>
  </V10Screen>;
}
function Conversation({ trip, focused }: { trip: any; focused: boolean }) {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const list = useRef<FlatList<any>>(null);
  const lock = useRef(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messages = useQuery({ queryKey: ['customer-trip-messages', trip.trip_id], queryFn: () => messagesApi.list(trip.trip_id), enabled: focused, refetchInterval: focused ? 2500 : false });
  const name = trip.driver?.name || 'Sjåføren din';
  const photoKey = `${trip.trip_id}:${trip.driver_id}:${trip.driver?.photo_version || ''}`;
  const [photo, setPhoto] = useState<{ key: string; source: any } | null>(null);
  const photoSource = photo?.key === photoKey ? photo.source : null;
  useEffect(() => {
    let current = true; setPhoto(null);
    void tripDriverPhotoSource(trip.trip_id).then(source => { if (current) setPhoto({ key: photoKey, source }); }).catch(() => {});
    return () => { current = false; };
  }, [photoKey, trip.trip_id]);
  const send = async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if (!text || !focused || lock.current) return;
    if (text.length > 500) { setError('Meldingen kan være maks 500 tegn.'); return; }
    lock.current = true; setSending(true); setError('');
    try {
      await messagesApi.send(trip.trip_id, text);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!preset) setDraft(previous => previous.trim() === text ? '' : previous);
      await qc.invalidateQueries({ queryKey: ['customer-trip-messages', trip.trip_id] });
    } catch { setError('Meldingen ble ikke bekreftet sendt. Kontroller samtalen før du prøver igjen.'); }
    finally { lock.current = false; setSending(false); }
  };
  return <KeyboardAvoidingView testID="customer-messages-conversation" style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Math.max(56, insets.top + 8) }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tilbake til turen" onPress={() => router.push(`/booking/${trip.trip_id}`)} style={{ marginLeft: -12, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevL" /></Pressable>
      <View style={{ width: 40, height: 40, borderRadius: 13.6, overflow: 'hidden', backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}>{photoSource ? <Image source={photoSource} onError={() => setPhoto(current => current?.key === photoKey ? null : current)} style={{ width: 40, height: 40 }} testID="message-driver-photo" /> : <Text style={{ fontFamily: font.semibold, fontSize: 14.4 }}>{name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}</Text>}</View>
      <View style={{ flex: 1 }}><Text style={v10.body}>{name.split(' ')[0]}{trip.driver?.plate ? ` · ${trip.driver.plate}` : ''}</Text><Text style={v10.caption}>Tur til {trip.dropoff_address || 'destinasjonen din'} · pågår</Text></View>
      {trip.driver?.phone ? <Pressable accessibilityRole="button" accessibilityLabel="Ring sjåføren" onPress={() => void Linking.openURL(`tel:${trip.driver.phone}`).catch(() => setError('Kunne ikke åpne telefonen.'))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="phone" /></Pressable> : null}
    </View>
    {messages.isPending ? <View style={{ flex: 1, justifyContent: 'center' }}><Loader /></View> : <FlatList ref={list} data={Array.isArray(messages.data?.messages) ? messages.data.messages : []} keyExtractor={(item, index) => String(item.id || index)} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 8 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<Text style={[v10.caption, { textAlign: 'center', marginTop: 4, marginBottom: 8 }]}>Samtalen er knyttet til denne turen.</Text>}
      ListEmptyComponent={<Text style={v10.secondary}>{messages.isError ? 'Kunne ikke hente meldingene.' : 'Ingen meldinger ennå.'}</Text>}
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      renderItem={({ item }) => {
        const mine = item.from_role === 'passenger';
        return <V10Entrance style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}><View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '100%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6, backgroundColor: mine ? colors.surfaceInverse : colors.cardSubtle }}><Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 21, color: mine ? colors.onInverse : colors.text }}>{item.text}</Text></View></V10Entrance>;
      }} />}
    {messages.isError ? <View style={{ paddingHorizontal: 16 }}><V10Action label="Hent meldinger på nytt" small kind="soft" onPress={() => void messages.refetch()} /></View> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingTop: 8 }}>{['Jeg kommer ut nå', 'Står ved inngang B', '2 min'].map(label => <Pressable key={label} accessibilityRole="button" disabled={sending} onPress={() => void send(label)} style={{ minHeight: 36, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.cardSubtle, justifyContent: 'center' }}><Text style={{ fontFamily: font.medium, fontSize: 14 }}>{label}</Text></Pressable>)}</View>
    {error ? <Text accessibilityRole="alert" testID="customer-message-error" style={[v10.secondary, { paddingHorizontal: 16, paddingTop: 8, color: colors.danger }]}>{error}</Text> : null}
    <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8, paddingHorizontal: 16, paddingBottom: Math.max(180, insets.bottom + 146) }}>
      <View style={{ flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 16, backgroundColor: colors.cardSubtle, justifyContent: 'center' }}><TextInput accessibilityLabel="Melding til sjåføren" testID="customer-message-input" placeholder={`Melding til ${name.split(' ')[0]}`} placeholderTextColor={colors.textMuted} value={draft} onChangeText={setDraft} editable={!sending} maxLength={500} returnKeyType="send" onSubmitEditing={() => void send()} style={{ fontSize: 16, color: colors.text, paddingVertical: 12 }} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Send melding" accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }} disabled={sending || !draft.trim()} onPress={() => void send()} testID="customer-message-send" style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: sending || !draft.trim() ? .55 : 1 }}>{sending ? <ActivityIndicator color={colors.accentOn} /> : <V10Icon name="send" color={colors.accentOn} />}</Pressable>
    </View>
  </KeyboardAvoidingView>;
}
