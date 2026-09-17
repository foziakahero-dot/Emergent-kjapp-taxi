import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * KJAPP Driver 2.0 — operational Nordic mobility UI.
 * Driver surfaces prioritise glanceability and status clarity over decoration.
 */
export const colors = {
  bg: '#050A0F',
  surface: '#091119',
  card: '#0A131B',
  cardSubtle: 'rgba(248,250,252,0.045)',
  elevated: '#0D1721',
  line: 'rgba(145,163,184,0.18)',
  lineStrong: 'rgba(145,163,184,0.32)',
  text: '#F8FAFC',
  textSecondary: '#C7D2DE',
  textMuted: '#91A3B8',
  accent: '#39E58C',
  accentHover: '#67EDA7',
  accentDim: '#23A967',
  accentSoft: 'rgba(57,229,140,0.12)',
  accentGlow: 'rgba(57,229,140,0.25)',
  accentOn: '#03120B',
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

const systemSans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;
export const font = {
  display: systemSans,
  body: systemSans,
  mono: 'JetBrainsMono',
};

export const FONT_ASSETS = {
  Fraunces: require('@/assets/fonts/Fraunces.ttf'),
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
