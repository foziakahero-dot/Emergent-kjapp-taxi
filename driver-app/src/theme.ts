import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * KJAPP Driver — glance-first operational UI.
 * Dark low-distraction canvas, cyan for navigation/action hierarchy and
 * green reserved for online/success state.
 */
export const colors = {
  bg: '#050A0F',
  surface: '#091119',
  card: '#0B141C',
  cardSubtle: 'rgba(248,250,252,0.04)',
  elevated: '#101C25',
  line: 'rgba(145,163,184,0.15)',
  lineStrong: 'rgba(145,163,184,0.26)',
  text: '#F8FAFC',
  textSecondary: '#A7B6C7',
  textMuted: '#73869A',
  accent: '#00E5F5',
  accentHover: '#67F3FC',
  accentDim: '#009EAA',
  accentSoft: 'rgba(0,229,245,0.12)',
  accentGlow: 'rgba(0,229,245,0.22)',
  accentOn: '#031114',
  success: '#39E58C',
  warning: '#F7C948',
  danger: '#FF6B72',
  dangerSoft: 'rgba(255,107,114,0.12)',
  online: '#39E58C',
  onlineSoft: 'rgba(57,229,140,0.12)',
  onlineGlow: 'rgba(57,229,140,0.26)',
  route: '#00E5F5',
  mapCanvas: '#04080B',
  mapWater: '#07131B',
  mapRoad: '#14212B',
  mapRoadMajor: '#233542',
  mapBuilding: '#101A22',
  driverBg: '#03070A',
  driverCard: '#081017',
};

export type ThemeColors = typeof colors;

const productSans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const font = {
  display: productSans,
  body: productSans,
  mono: productSans,
};

export const FONT_ASSETS = {
  Fraunces: require('@/assets/fonts/Fraunces.ttf'),
  JetBrainsMono: require('@/assets/fonts/JetBrainsMono-Regular.ttf'),
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 };
export const spacing = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
  x16: 64,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export function useTheme() {
  return { colors, font, radius, spacing };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: ThemeColors) => T,
) {
  return function useStyles(): T {
    return useMemo(() => StyleSheet.create(factory(colors)), []);
  };
}
