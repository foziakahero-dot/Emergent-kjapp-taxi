import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_800ExtraBold } from '@expo-google-fonts/geist/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';

/** SNAR V10 Driver — Geist typography and warm-neutral surfaces with truthful status colors. */
export const colors = {
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardSubtle: '#F1EEE8',
  elevated: '#FFFFFF',
  surfaceInverse: '#0B1A2C',
  onInverse: '#F4F6F9',
  line: 'rgba(11,26,44,0.08)',
  lineStrong: 'rgba(11,26,44,0.14)',
  text: '#0B1A2C',
  textSecondary: '#4B5A6C',
  textMuted: '#8A95A3',
  accent: '#E00000',
  accentHover: '#C80000',
  accentDim: '#A80000',
  accentSoft: 'rgba(224,0,0,0.08)',
  accentGlow: 'rgba(224,0,0,0.18)',
  accentOn: '#FFFFFF',
  success: '#0D7A58',
  warning: '#A35A00',
  danger: '#D0001A',
  dangerSoft: 'rgba(208,0,26,0.08)',
  info: '#1A5FB4',
  online: '#0D7A58',
  onlineSoft: 'rgba(13,122,88,0.1)',
  onlineGlow: 'rgba(13,122,88,0.18)',
  route: '#0B1A2C',
  mapCanvas: '#EFECE6',
  mapRoad: '#FFFFFF',
  mapRoadMajor: '#FBFAF7',
  mapBuilding: '#E4E0D8',
  driverBg: '#F7F5F1',
  driverCard: '#FFFFFF',
};

export type ThemeColors = typeof colors;

export const font = {
  display: 'Geist_600SemiBold',
  body: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  light: 'Geist_300Light',
  extraBold: 'Geist_800ExtraBold',
  mono: 'JetBrainsMono',
  monoMedium: 'JetBrainsMono_500Medium',
};

export const FONT_ASSETS = {
  Geist_300Light,
  Geist_800ExtraBold,
  JetBrainsMono_500Medium,
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
  base: 300,
  sheet: 300,
  slow: 700,
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
