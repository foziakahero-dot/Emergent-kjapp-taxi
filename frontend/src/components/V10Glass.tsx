import React, { type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, useColorTheme } from '@/src/theme';

/** Original glass surface over the map. Android SDK 31+ uses its explicit map target. */
export function V10Glass({ target }: { target?: RefObject<View | null> }) {
  const theme = useColorTheme();
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <BlurView blurTarget={target} blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'} intensity={36} tint={theme.effective === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
  </View>;
}
