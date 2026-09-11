import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * KJAPP — Nordic Precision meets Understated Luxury.
 * Single dark palette (Fjord & Granite + Nordic Brass + Ivory).
 * Driver-specific accents are exposed as `driver.*`.
 */
export const colors = {
  bg: '#070B0E',
  surface: '#0C1216',
  card: '#0E151A',
  cardSubtle: 'rgba(244,244,240,0.045)',
  elevated: '#121A20',
  line: 'rgba(244,244,240,0.08)',
  lineStrong: 'rgba(244,244,240,0.16)',
  text: '#F4F4F0',
  textSecondary: '#C8CED4',
  textMuted: '#8A96A0',
  accent: '#CBA365',
  accentHover: '#DDB77A',
  accentDim: '#8F6E3E',
  accentSoft: 'rgba(203,163,101,0.14)',
  accentGlow: 'rgba(203,163,101,0.35)',
  accentOn: '#070B0E',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  online: '#2FE08C',
  onlineSoft: 'rgba(47,224,140,0.14)',
  onlineGlow: 'rgba(47,224,140,0.45)',
  mapCanvas: '#06090A',
  mapWater: '#080E12',
  mapRoad: '#12181D',
  mapRoadMajor: '#1B232A',
  mapBuilding: '#161D24',
  driverBg: '#030607',
  driverCard: '#0A0F13',
};

export type ThemeColors = typeof colors;

export const font = {
  display: 'Fraunces',
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  mono: 'JetBrainsMono',
};

export const FONT_ASSETS = {
  Fraunces: require('@/assets/fonts/Fraunces.ttf'),
  JetBrainsMono: require('@/assets/fonts/JetBrainsMono-Regular.ttf'),
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

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
