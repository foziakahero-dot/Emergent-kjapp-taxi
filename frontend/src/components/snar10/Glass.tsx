import React, { type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, useColorTheme } from '@/src/theme';

/** One blur followed by one source tint. Missing/unsupported Android blur retains the tint. */
export function Glass({ target }: { target?: RefObject<View | null> }) {
  const theme = useColorTheme();
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <BlurView blurTarget={target} blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
      intensity={36} tint={theme.effective === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
    <View testID="snar10-glass-tint" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
  </View>;
}
