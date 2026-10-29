import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Typography';
import { V10Action, v10 } from './V10UI';
import { colors } from '@/src/theme';

export function DriverNavigationPanel({ navigation: n, onExternal }: { navigation: {
  loading: boolean; instruction: string; error: string; muted: boolean;
  distanceRemaining?: number; durationRemaining?: number;
  stop(): Promise<void>; toggleMuted(): Promise<void>;
}; onExternal(): void }) {
  const insets = useSafeAreaInsets();
  return <View testID="driver-native-navigation" style={{ position: 'absolute', top: insets.top + 8,
    left: 12, right: 12, borderRadius: 24, padding: 16, gap: 10, backgroundColor: colors.surface }}>
    <Text accessibilityRole="header" style={v10.heading}>{n.loading ? 'Beregner kjørerute…' : n.instruction || 'Følg ruten til avtalt stopp'}</Text>
    <Text style={v10.secondary}>{n.distanceRemaining != null ? `${(n.distanceRemaining / 1000).toFixed(1)} km` : ''}
      {n.durationRemaining != null ? ` · ${Math.ceil(n.durationRemaining / 60)} min` : ''}</Text>
    {n.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{n.error}</Text> : null}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <V10Action small kind="soft" label={n.muted ? 'Slå på tale' : 'Demp tale'} onPress={() => void n.toggleMuted().catch(() => {})} />
      <V10Action small kind="soft" label="Tilbake til tur" onPress={() => void n.stop()} />
    </View>
    <V10Action small kind="ghost" label="Google Maps / Waze" onPress={onExternal} />
  </View>;
}
