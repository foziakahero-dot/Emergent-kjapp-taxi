import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';
export function Ring({ value, size = 64, color = colors.success, stroke = 3, radius = size / 2 - stroke, children }: { value: number | null; size?: number; color?: string; stroke?: number; radius?: number; children?: React.ReactNode }) {
  useColorTheme();
  const length = 2 * Math.PI * radius;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><Svg width={size} height={size} style={StyleSheet.absoluteFill}>
    <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.lineStrong} strokeWidth={stroke} fill="none" />
    {value !== null ? <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${length} ${length}`} strokeDashoffset={length * (1 - Math.max(0, Math.min(1, value)))} strokeLinecap="round" rotation={-90} origin={`${size / 2}, ${size / 2}`} /> : null}
  </Svg>{children}</View>;
}
