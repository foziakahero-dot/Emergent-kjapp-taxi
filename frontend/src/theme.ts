import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Inter_300Light } from '@expo-google-fonts/inter/300Light';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { Geist_800ExtraBold } from '@expo-google-fonts/geist/800ExtraBold';

/** SNAR V10 Customer — warm neutral surfaces, Geist typography and restrained red actions. */
export const colors = {
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardSubtle: '#F1EEE8',
  elevated: '#FFFFFF',
  surfaceInverse: '#0B1A2C',
  onInverse: '#F7F5F1',
  surfaceRaised: '#FFFFFF',
  line: 'rgba(11,26,44,0.09)',
  lineStrong: 'rgba(11,26,44,0.16)',
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
  onlineSoft: '#E6F6F0',
  onlineGlow: 'rgba(13,122,88,0.18)',
  route: '#E00000',
  mapCanvas: '#F1EEE8',
  mapWater: '#DCE8EB',
  mapRoad: '#FFFFFF',
  mapRoadMajor: '#FAF8F4',
  mapBuilding: '#E9E5DD',
  driverBg: '#08131F',
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
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  Inter_300Light,
  Inter_800ExtraBold,
  JetBrainsMono_500Medium,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  JetBrainsMono: require('@/assets/fonts/JetBrainsMono-Regular.ttf'),
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, sheet: 30, button: 16, pill: 999 };
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
  instant: 150,
  fast: 150,
  base: 210,
  sheet: 280,
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
