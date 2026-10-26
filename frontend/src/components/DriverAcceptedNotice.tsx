import React from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';

export function DriverAcceptedNotice({ driver, eta, etaStatus, offline, onClose, onCall, onChat, onLayout }: {
  driver: { name?: string; brand?: string; model?: string; car?: string; color?: string; plate?: string; rating?: number; phone?: string };
  eta: number | null; etaStatus?: string; offline: boolean; onClose: () => void; onCall: () => void; onChat: () => void; onLayout: (height: number) => void;
}) {
  useColorTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const vehicle = [driver.brand, driver.model].filter(Boolean).join(' ') || driver.car || 'Bilinformasjon mangler';
  const rating = typeof driver.rating === 'number' && Number.isFinite(driver.rating) && driver.rating >= 0 && driver.rating <= 5 ? `★ ${driver.rating.toLocaleString('nb-NO', { maximumFractionDigits: 2 })}` : 'Ingen vurderinger ennå';
  const button = { minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: colors.cardSubtle, alignItems: 'center' as const, justifyContent: 'center' as const, flex: 1 };
  return <View testID="driver-accepted-notice" accessibilityLiveRegion="assertive" onLayout={event => onLayout(event.nativeEvent.layout.height)}
    style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, maxHeight: height * .5, padding: 18, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, zIndex: 80 }}>
    <ScrollView contentContainerStyle={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 23 }}>Sjåføren har akseptert turen</Text>
      <Text testID="accepted-driver-full-name" style={{ fontSize: 20, fontFamily: font.semibold }}>{driver.name || 'Navn ikke tilgjengelig'}</Text>
      <Text>{vehicle} · {driver.color || 'Farge ikke registrert'}</Text>
      <Text testID="accepted-driver-plate" style={{ fontFamily: font.semibold, fontSize: 21 }}>{driver.plate || 'Registreringsnummer mangler'}</Text>
      <Text>{rating}</Text>
      <Text testID="accepted-driver-eta">{offline ? 'Venter på oppdatert turinformasjon' : eta !== null ? `Ankomst om ca. ${eta} min til hentestedet` : etaStatus === 'loading' ? 'Beregner kjøretid til hentestedet…' : 'Kjøretid er foreløpig ikke tilgjengelig'}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable testID="accepted-driver-call" accessibilityRole="button" accessibilityLabel="Ring sjåføren" accessibilityState={{ disabled: !driver.phone }} disabled={!driver.phone} onPress={onCall} style={[button, { opacity: driver.phone ? 1 : .45 }]}><Text>Ring sjåfør</Text></Pressable>
        <Pressable testID="accepted-driver-message" accessibilityRole="button" onPress={onChat} style={button}><Text>Send melding</Text></Pressable>
      </View>
      <Pressable testID="accepted-driver-close" accessibilityRole="button" onPress={onClose} style={{ padding: 10, alignItems: 'center' }}><Text>Følg bilen på kartet</Text></Pressable>
    </ScrollView>
  </View>;
}
