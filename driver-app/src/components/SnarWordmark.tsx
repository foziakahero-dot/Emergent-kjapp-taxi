import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/src/components/Typography';
import { colors, font, useColorTheme } from '@/src/theme';

/** Wordmark treatment from the approved October 28 screen references. */
export function SnarWordmark() {
  useColorTheme();
  return <View accessibilityLabel="SNAR" accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Text style={{ fontFamily: font.bold, fontSize: 29, letterSpacing: 6, color: colors.text }}>SNAR</Text>
    <Svg width={25} height={36} viewBox="0 0 25 36"><Path d="M12 7L25 0 13 29 0 36Z" fill={colors.accent} /></Svg>
  </View>;
}
