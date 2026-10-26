import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Group, V10Row, V10Sheet, v10 } from '@/src/components/V10UI';
import { CustomerJourney, finiteMetric, paymentLabel } from '@/src/components/BookingPrimitives';
import { Map } from '@/src/components/Map';
import { VehicleAsset, type VehicleKind } from '@/src/components/VehicleAsset';
import { V10VoiceBars } from '@/src/components/V10VoiceBars';
import { V10Entrance } from '@/src/components/V10Entrance';
import { useTheme } from '@/src/theme';
import { kr } from '@/src/lib/format';

type Props = {
  messages: { role: string; content: string }[]; input: string; onInput: (text: string) => void;
  step: string; busy: boolean; transcribing: boolean; recording: boolean; metering?: number; voiceOpen: boolean;
  pickup: any; dropoff: any; estimate: any; options: any[]; selected: any; payment: any;
  error: string; onBack: () => void; onCancel: () => void;
  onSend: (text?: string) => void; onVoice: () => void; onCloseVoice: () => void;
  onPlace: (place: any) => void; onVehicle: (type: string) => void; onConfirm: () => void;
  onPayment: () => void; results: any[]; scrollRef: React.RefObject<ScrollView | null>;
};
const names: Record<string, string> = { 'ai-first': 'SNAR', trygg: 'SNAR XL', premium: 'Premium' };
export function CustomerAssistView(p: Props) {
  const { colors, font } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheetHeight, setSheetHeight] = useState(300);
  const policy = p.selected?.waiting_policy;
  const blocked = p.busy || p.transcribing || p.recording;
  const conversation = <View style={{ gap: 16 }}>{p.messages.map((message, index) => <V10Entrance key={index} style={{ maxWidth: '90%', alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: message.role === 'user' ? 6 : 18, backgroundColor: message.role === 'user' ? colors.cardSubtle : colors.surface }}><Text style={v10.secondary}>{message.content}</Text></V10Entrance>)}</View>;
  const proposal = <>
    {p.results.length ? <View style={{ marginTop: 20, gap: 8 }}><Text style={v10.overline}>Velg riktig adresse</Text>{p.results.map((place, index) => <V10Group key={`${place.name}-${index}`} style={{ paddingHorizontal: 14 }}><V10Row icon="destination" title={place.name} testID={`assist-place-${index}`} disabled={blocked} onPress={() => p.onPlace(place)} /></V10Group>)}</View> : null}
    {p.step === 'category' ? <View style={{ marginTop: 20, gap: 6 }}><Text style={v10.heading}>Velg bil</Text><Text style={v10.caption}>{finiteMetric(p.estimate?.duration_min, 'min')} kjøretid · {finiteMetric(p.estimate?.distance_km, 'km')}</Text>{p.options.map(option => <Pressable key={option.vehicle_type} testID={`assist-vehicle-${option.vehicle_type}`} disabled={blocked} accessibilityRole="button" onPress={() => p.onVehicle(option.vehicle_type)} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 18, backgroundColor: colors.surface }}><VehicleAsset kind={option.vehicle_type as VehicleKind} width={84} height={50} /><Text style={[v10.body, { flex: 1 }]}>{names[option.vehicle_type] || option.vehicle_type}</Text><Text style={v10.body}>{kr(option.price)}</Text></Pressable>)}</View> : null}
    {['confirm', 'booking'].includes(p.step) && p.selected ? <V10Entrance pop><V10Group style={{ padding: 18, marginTop: 20 }}><Text style={[v10.heading, { marginBottom: 16 }]}>Dette forstod jeg</Text><CustomerJourney pickup={p.pickup?.name || 'Velg hentested'} destination={p.dropoff?.name} />
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 20 }}><View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.cardSubtle }}><Text style={v10.caption}>Kjøretøy</Text><Text style={v10.body}>{names[p.selected.vehicle_type] || p.selected.vehicle_type}</Text></View><Pressable testID="assist-payment" onPress={p.onPayment} style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.cardSubtle }}><Text style={v10.caption}>Betaling</Text><Text style={v10.body}>{paymentLabel(p.payment)}</Text></Pressable></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}><Text style={v10.secondary}>Fast pris, inkl. mva</Text><Text style={v10.title}>{kr(p.selected.price)}</Text></View>
      {policy ? <Text testID="assist-waiting-notice" style={[v10.secondary, { marginBottom: 16 }]}>Ventetid: {policy.free_minutes} min inkludert, deretter {kr(policy.per_minute)}/min, maks {kr(policy.max_fee)}. Ved bestilling reserveres opptil {kr(Number(p.selected.price) + policy.max_fee)} på kortet. Ubrukt beløp frigjøres.</Text> : null}
      <V10Action testID="assist-confirm" label="Bekreft og bestill" busy={p.busy} disabled={blocked || !p.payment} onPress={p.onConfirm} />
    </V10Group></V10Entrance> : null}
    {p.busy && p.step !== 'booking' ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' }}><ActivityIndicator color={colors.accent} /><Text style={v10.secondary}>Henter data…</Text></View> : null}
    {p.error ? <Text testID="assist-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 16 }]}>{p.error}</Text> : null}
  </>;
  const voiceButton = <Pressable testID="assist-mic" disabled={p.transcribing || p.busy} accessibilityRole="button" accessibilityLabel={p.recording ? 'Stopp taleopptak' : 'Start taleopptak'} onPress={p.onVoice} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: p.recording ? colors.accent : colors.surface, alignItems: 'center', justifyContent: 'center' }}>{p.transcribing ? <ActivityIndicator color={colors.accent} /> : <V10Icon name="voice" color={p.recording ? colors.accentOn : colors.text} />}</Pressable>;
  if (p.voiceOpen) return <View style={{ flex: 1, backgroundColor: colors.mapCanvas }}>
    <Map style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pickup={p.pickup} dropoff={p.dropoff} route={p.estimate?.geometry?.coordinates} focusRoute={p.estimate?.geometry?.coordinates} showControls={false} contentInsets={{ top: insets.top + 24, bottom: sheetHeight + 32, left: 32, right: 32 }} focusMode={p.estimate ? 'route' : 'nearby'} testID="assist-map" />
    <V10Sheet testID="assist-voice-sheet" onLayout={event => setSheetHeight(event.nativeEvent.layout.height)}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><V10VoiceBars recording={p.recording} metering={p.metering} /><View style={{ flex: 1 }}><Text style={v10.caption}>{p.recording ? 'Lytter…' : p.transcribing ? 'Forstår…' : p.busy ? 'Henter turforslag…' : p.selected ? 'Dette forstod jeg' : 'Snakk med SNAR'}</Text><Text style={[v10.body, { fontSize: 17 }]}>{p.recording ? 'Si hvor du skal. Trykk for å stoppe.' : p.messages.filter(message => message.role === 'user').at(-1)?.content || 'Start opptak for å si hvor du skal.'}</Text></View></View>
      <View style={{ marginTop: 16, alignItems: 'center' }}>{voiceButton}</View>{proposal}<View style={{ marginTop: 12 }}><V10Action testID="assist-voice-close" label="Tilbake til tekst" kind="ghost" onPress={p.onCloseVoice} /></View>
    </V10Sheet>
  </View>;
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={p.scrollRef} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Math.max(60, insets.top + 12), paddingBottom: 24 }}>
      <Pressable testID="assist-back" onPress={p.onBack} accessibilityRole="button" accessibilityLabel="Tilbake" style={{ width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevL" /></Pressable><Text style={[v10.overline, { marginTop: 8 }]}>SNAR AI</Text><Text style={[v10.title, { marginTop: 4 }]}>Hva trenger du?</Text>
      {p.step === 'chat' && p.messages.length <= 1 ? <View style={{ gap: 8, marginTop: 20 }}>{[['vehicle', 'Bestill en tur', 'Velg hentested, reisemål og bil', 'Bestill taxi'], ['payment', 'Hva koster en tur?', 'Se pris før du bestiller', 'Hva koster en tur?'], ['help', 'Få hjelp', 'Spør SNAR om turen din', 'Kundeservice']].map(([icon, title, subtitle, prompt], i) => <V10Entrance key={title} delay={Math.min(i, 2) * 60}><V10Group style={{ padding: 14 }}><V10Row icon={icon} title={title} subtitle={subtitle} testID={`assist-quick-${i}`} disabled={blocked} onPress={() => p.onSend(prompt)} right={<V10Icon name="arrowR" size={18} color={colors.textMuted} />} /></V10Group></V10Entrance>)}</View> : <View style={{ marginTop: 20 }}>{conversation}</View>}{proposal}
      {p.step !== 'chat' ? <View style={{ marginTop: 12 }}><V10Action testID="assist-cancel" label="Avbryt bestilling" kind="ghost" disabled={blocked} onPress={p.onCancel} /></View> : null}
    </ScrollView>
    <View style={{ marginHorizontal: 16, marginBottom: insets.bottom + 100, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}><TextInput testID="assist-input" accessibilityLabel="Fortell SNAR" value={p.input} onChangeText={p.onInput} placeholder={p.step === 'destination' ? 'Hvor skal du?' : 'Fortell SNAR hva du trenger'} placeholderTextColor={colors.textMuted} style={{ flex: 1, minWidth: 0, color: colors.text, fontFamily: font.body, fontSize: 16 }} returnKeyType="send" onSubmitEditing={() => p.onSend()} editable={!blocked} /><Pressable testID="assist-send" disabled={blocked || !p.input.trim()} accessibilityRole="button" accessibilityLabel="Send" onPress={() => p.onSend()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="arrowR" size={20} color={blocked ? colors.textMuted : colors.text} /></Pressable></View>{voiceButton}</View>
  </KeyboardAvoidingView>;
}
