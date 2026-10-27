import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';

export function DriverSearchOverlay({ trip, busy, error, offline, onCancel, onDeadline }: {
  trip: any; busy?: boolean; error?: string; offline?: boolean; onCancel: () => void; onDeadline: () => void;
}) {
  useColorTheme();
  const [elapsed, setElapsed] = useState(0);
  const deadline = useRef(onDeadline); deadline.current = onDeadline;
  const checked = useRef('');
  useEffect(() => {
    const received = Date.now();
    const start = Date.parse(trip.search_started_at || trip.authorized_at || trip.created_at || '');
    const server = Date.parse(trip.server_time || '');
    const age = Number.isFinite(start) ? Math.max(0, ((Number.isFinite(server) ? server : received) - start) / 1000) : 0;
    const tick = () => {
      const seconds = Math.min(60, Math.floor(age + (Date.now() - received) / 1000));
      setElapsed(seconds);
      if (seconds >= 60 && checked.current !== trip.trip_id) { checked.current = trip.trip_id; deadline.current(); }
    };
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [trip.trip_id, trip.search_started_at, trip.server_time]);
  return <Modal visible transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={() => {}}>
    <View testID="driver-search-overlay" accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(8,19,31,.68)', padding: 28, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <View style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 24, gap: 18, alignItems: 'center', backgroundColor: colors.surface }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator testID="driver-search-spinner" size="large" color={colors.accent} style={{ transform: [{ scale: 2.2 }] }} /></View>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.semibold, fontSize: 24, textAlign: 'center', color: colors.text }}>Finner nærmeste sjåfør…</Text>
      <Text testID="driver-search-seconds" style={{ fontVariant: ['tabular-nums'], fontSize: 24, color: colors.textSecondary }}>{elapsed} sekunder</Text>
      <Text style={{ textAlign: 'center', color: colors.textSecondary }}>Vi gir deg beskjed når en sjåfør har bekreftet.</Text>
      {elapsed === 60 ? <Text accessibilityLiveRegion="polite">Bekrefter avslutning av søket…</Text> : null}
      {offline ? <Text accessibilityRole="alert" style={{ textAlign: 'center' }}>Venter på kontakt med SNAR. Søket avsluttes på serveren etter 60 sekunder.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
      <Pressable testID="driver-search-cancel" accessibilityRole="button" disabled={busy} onPress={onCancel} style={{ minHeight: 56, minWidth: 200, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        <Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: 17 }}>{busy ? 'Avbryter…' : 'Avbryt søk'}</Text>
      </Pressable>
      </View>
    </View>
  </Modal>;
}
