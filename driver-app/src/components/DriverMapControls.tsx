import React from 'react';
import { Pressable, View } from 'react-native';
import { V10Icon } from './V10Icon';
import { colors, useColorTheme } from '@/src/theme';

export function DriverMapControls({ top = 116, onZoomIn, onZoomOut, onRecenter }: {
  top?: number; onZoomIn: () => void; onZoomOut: () => void; onRecenter: () => void;
}) {
  useColorTheme();
  const button = (label: string, icon: string, testID: string, onPress: () => void) => <Pressable
    accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress}
    style={({ pressed }) => ({ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .6 : 1 })}>
    <V10Icon name={icon} size={23} color={colors.text} />
  </Pressable>;
  const surface = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, boxShadow: colors.elevation1, overflow: 'hidden' as const };
  return <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, top, gap: 10 }}>
    <View style={[surface, { borderRadius: 23 }]}>
      {button('Zoom inn', 'plus', 'map-zoom-in', onZoomIn)}
      <View style={{ height: 1, marginHorizontal: 10, backgroundColor: colors.lineStrong }} />
      {button('Zoom ut', 'minus', 'map-zoom-out', onZoomOut)}
    </View>
    <View style={[surface, { borderRadius: 23 }]}>{button('Sentrer kartet', 'locate', 'map-recenter', onRecenter)}</View>
  </View>;
}
