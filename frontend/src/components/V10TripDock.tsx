import React, { type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';

export function V10TripDock({ target, active = 'driver', onDriver, onMessage, onSafety, onTrip }: { target?: RefObject<View | null>; active?: 'driver' | 'message' | 'safety' | 'trip'; onDriver: () => void; onMessage: () => void; onSafety: () => void; onTrip: () => void }) {
  const theme = useColorTheme();
  const insets = useSafeAreaInsets();
  const items = [{ id: 'driver', label: 'Sjåfør', action: onDriver }, { id: 'message', label: 'Melding', action: onMessage }, { id: 'safety', label: 'Sikkerhet', action: onSafety }, { id: 'trip', label: 'Tur', action: onTrip }];
  return <View testID="trip-dock" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(22, insets.bottom + 6), height: 66, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, boxShadow: colors.elevation2 }}>
    <BlurView blurTarget={target} blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'} intensity={44} tint={theme.effective === 'dark' ? 'dark' : 'light'} pointerEvents="none" style={StyleSheet.absoluteFill} />
    {items.map(item => <Pressable key={item.id} testID={`trip-dock-${item.id}`} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === active }} onPress={item.action}
      style={({ pressed }) => ({ width: 58, height: 54, alignItems: 'center', justifyContent: 'center', gap: 3, transform: [{ scale: pressed ? .9 : 1 }] })}>
      <V10Icon name={item.id} size={22} color={item.id === active ? colors.text : colors.textMuted} />
      <Text style={{ fontFamily: font.medium, fontSize: 10.5, lineHeight: 14, color: item.id === active ? colors.text : colors.textMuted }}>{item.label}</Text>
    </Pressable>)}
  </View>;
}
