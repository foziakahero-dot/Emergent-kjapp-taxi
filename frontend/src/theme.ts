import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';

/**
 * KJAPP 2.0 — premium Nordic mobility.
 * Mobility first. AI stays visually quiet until it is useful.
 * Customer surfaces use cyan/ice; semantic aliases prevent hard-coded accent drift.
 */
export const colors = {
  bg: '#050A0F',
  surface: '#091119',
  card: '#0D1721',
  cardSubtle: 'rgba(248,250,252,0.045)',
  elevated: '#12202B',
  line: 'rgba(145,163,184,0.18)',
  lineStrong: 'rgba(145,163,184,0.32)',
  text: '#F8FAFC',
  textSecondary: '#C7D2DE',
  textMuted: '#91A3B8',
  accent: '#00E5F5',
  accentHover: '#52F0FA',
  accentDim: '#00A7B3',
  accentSoft: 'rgba(0,229,245,0.12)',
  accentGlow: 'rgba(0,229,245,0.24)',
  accentOn: '#031014',
  success: '#39E58C',
  warning: '#F4C95D',
  danger: '#FF5C6C',
  dangerSoft: 'rgba(255,92,108,0.14)',
  info: '#5BA7FF',
  online: '#39E58C',
  onlineSoft: 'rgba(57,229,140,0.14)',
  onlineGlow: 'rgba(57,229,140,0.30)',
  route: '#00E5F5',
  mapCanvas: '#050A0F',
  mapWater: '#07131B',
  mapRoad: '#16222D',
  mapRoadMajor: '#223342',
  mapBuilding: '#101A23',
  driverBg: '#050A0F',
  driverCard: '#0A131B',
};

export type ThemeColors = typeof colors;

export const font = {
  display: 'Geist_600SemiBold',
  body: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'JetBrainsMono',
};

export const FONT_ASSETS = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
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
