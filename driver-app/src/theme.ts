import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

/** KJAPP Driver — shared light/navy/red system with green for real online status. */
export const colors = {
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardSubtle: '#EEF1F5',
  elevated: '#FFFFFF',
  line: 'rgba(0,31,63,0.10)',
  lineStrong: 'rgba(0,31,63,0.18)',
  text: '#001F3F',
  textSecondary: '#4A5A6E',
  textMuted: '#637489',
  accent: '#FF0000',
  accentHover: '#FF3B3B',
  accentDim: '#CC0000',
  accentSoft: '#FFE6E6',
  accentGlow: 'rgba(255,0,0,0.25)',
  accentOn: '#FFFFFF',
  success: '#12B981',
  warning: '#9A5700',
  danger: '#B42329',
  dangerSoft: '#FFF0F0',
  info: '#245FAD',
  online: '#12B981',
  onlineSoft: '#E5F7ED',
  onlineGlow: 'rgba(18,185,129,0.24)',
  route: '#FF0000',
  mapCanvas: '#E9EEF3',
  mapWater: '#D8E8F0',
  mapRoad: '#FFFFFF',
  mapRoadMajor: '#F8FAFC',
  mapBuilding: '#E2E8EE',
  driverBg: '#F4F6FA',
  driverCard: '#FFFFFF',
};

export type ThemeColors = typeof colors;

export const font = {
  display: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono',
};

export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono: require('@/assets/fonts/JetBrainsMono-Regular.ttf'),
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  hero: 64,
};

export const motion = {
  instant: 100,
  fast: 160,
  base: 240,
  sheet: 280,
  slow: 400,
};

export function useTheme() {
  return { colors, font, radius, spacing, motion };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: ThemeColors) => T,
) {
  return function useStyles(): T {
    return useMemo(() => StyleSheet.create(factory(colors)), []);
  };
}
