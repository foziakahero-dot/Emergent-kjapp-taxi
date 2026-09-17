import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

/**
 * KJAPP Customer — Nordic mobility first.
 * Calm dark canvas, cyan/ice signal color, restrained surfaces.
 * AI is a capability in the booking flow, not the visual identity.
 */
export const colors = {
  bg: '#050A0F',
  surface: '#091119',
  card: '#0D1721',
  cardSubtle: 'rgba(248,250,252,0.045)',
  elevated: '#12202B',
  line: 'rgba(145,163,184,0.16)',
  lineStrong: 'rgba(145,163,184,0.28)',
  text: '#F8FAFC',
  textSecondary: '#91A3B8',
  textMuted: '#718398',
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
  onlineGlow: 'rgba(57,229,140,0.28)',
  mapCanvas: '#05090D',
  mapWater: '#07131B',
  mapRoad: '#14212B',
  mapRoadMajor: '#20313D',
  mapBuilding: '#111C25',
  route: '#00E5F5',
  pickup: '#F8FAFC',
  dropoff: '#00E5F5',
  driverBg: '#050A0F',
  driverCard: '#0A1219',
};

export type ThemeColors = typeof colors;

// Geist is the design-system target. Until the bundled Geist asset is added,
// use the platform sans family rather than the legacy editorial serif.
const productSans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const font = {
  display: productSans,
  body: productSans,
  mono: productSans,
};

// Kept for backwards-compatible root font loading; these fonts are no longer
// used by production UI styles in the customer app.
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
  // backwards-compatible aliases
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
