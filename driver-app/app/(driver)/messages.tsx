import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi, messagesApi } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Header, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { colors, font, useColorTheme } from '@/src/theme';
import { Loader } from '@/src/components/ui';
import * as Haptics from 'expo-haptics';

const activeStatuses = new Set(['driver_on_way', 'at_pickup', 'in_trip']);
export default function DriverMessages() {
  useColorTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const current = useQuery({ queryKey: ['driver-message-trip', user?.id], queryFn: driverApi.current, enabled: focused && !!user?.id, refetchInterval: focused ? 3000 : false });
  const trip = current.data?.trip || current.data;
  const canChat = !!trip?.trip_id && activeStatuses.has(trip.status);
  if (canChat && !current.isError) return <Conversation key={trip.trip_id} trip={trip} focused={focused} />;
  return <V10Screen dock testID="driver-messages-screen"><V10Header title="Meldinger" />
    <View style={{ marginTop: 24 }}>{current.isPending ? <Loader /> : current.isError ?
      <V10State icon="wifiOff" warning title="Kunne ikke hente reisestatus" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void current.refetch()} /> :
      <V10State icon="message" title="Ingen aktive samtaler" body="Når du har en tildelt tur, kan du sende meldinger til kunden her." action="Til cockpit" onAction={() => router.navigate('/(driver)/home')} />}
    </View>
  </V10Screen>;
}

function Conversation({ trip, focused }: { trip: any; focused: boolean }) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const lock = useRef(false);
  const [sending, setSending] = useState('');
  const [error, setError] = useState('');
  const messages = useQuery({ queryKey: ['driver-trip-messages', trip.trip_id], queryFn: () => messagesApi.list(trip.trip_id), enabled: focused, refetchInterval: focused ? 3000 : false });
  const name = trip.customer?.name || 'Kunden din';
  const send = async (text: string) => {
    if (lock.current || !focused) return;
    lock.current = true; setSending(text); setError('');
    try { await messagesApi.send(trip.trip_id, text); await qc.invalidateQueries({ queryKey: ['driver-trip-messages', trip.trip_id] }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
    catch { setError('Meldingen ble ikke bekreftet sendt. Kontroller samtalen før du prøver igjen.'); }
    finally { lock.current = false; setSending(''); }
  };
  return <View testID="driver-messages-conversation" style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Math.max(56, insets.top + 8) }}>
    <View style={{ paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><Text style={[v10.body, { fontSize: 16 }]}>{name.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}</Text></View>
      <View style={{ flex: 1 }}><Text style={v10.body}>{name}</Text><Text style={v10.caption}>Henting {trip.pickup_address}</Text></View>
      {trip.customer?.phone ? <Pressable accessibilityRole="button" accessibilityLabel="Ring kunden" onPress={() => void Linking.openURL(`tel:${trip.customer.phone}`).catch(() => setError('Kunne ikke åpne telefonen.'))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="phone" /></Pressable> : null}
    </View>
    {messages.isPending ? <View style={{ flex: 1, justifyContent: 'center' }}><Loader /></View> : <FlatList
      data={Array.isArray(messages.data?.messages) ? messages.data.messages : []} keyExtractor={(item, index) => String(item.id || index)}
      contentContainerStyle={{ padding: 20, gap: 10 }} style={{ flex: 1 }}
      ListEmptyComponent={<Text style={v10.secondary}>{messages.isError ? 'Kunne ikke hente meldingene.' : 'Ingen meldinger ennå.'}</Text>}
      renderItem={({ item }) => <View style={{ alignSelf: item.from_role === 'driver' ? 'flex-end' : 'flex-start', maxWidth: '80%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: item.from_role === 'driver' ? colors.surfaceInverse : colors.cardSubtle }}>
        <Text style={{ fontFamily: font.body, fontSize: 17, lineHeight: 23, color: item.from_role === 'driver' ? colors.onInverse : colors.text }}>{item.text}</Text>
      </View>} />}
    {messages.isError ? <View style={{ paddingHorizontal: 16 }}><V10Action label="Hent meldinger på nytt" kind="soft" small onPress={() => void messages.refetch()} /></View> : null}
    {error ? <Text accessibilityRole="alert" style={[v10.secondary, { paddingHorizontal: 16, paddingBottom: 8, color: colors.danger }]}>{error}</Text> : null}
    <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 86, gap: 8 }}>
      {[['Jeg er fremme', '2 min unna'], ['Finner deg ikke', 'Står i taxifilen']].map((row, index) => <View key={index} style={{ flexDirection: 'row', gap: 8 }}>{row.map(text =>
        <Pressable key={text} accessibilityRole="button" accessibilityState={{ disabled: !!sending }} disabled={!!sending} onPress={() => void send(text)} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 12, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, transform: [{ scale: pressed ? .97 : 1 }] })}>
          {sending === text ? <ActivityIndicator color={colors.text} /> : <Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 20, letterSpacing: -.14 }}>{text}</Text>}
        </Pressable>)}</View>)}
    </View>
  </View>;
}
