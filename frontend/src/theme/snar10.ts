import type { TextStyle } from 'react-native';

/** SNAR Fleet v2 / snar10: values from the owner's supplied index.css.
 * CSS em tracking is converted to native points; font files use nearest static weights.
 * Expo blur intensity is a native setting, never a claimed px conversion.
 */
export const colors = {
  primary: '#E00000',
  primaryHover: '#C80000',
  primaryPressed: '#A80000',
  primarySoft: 'rgba(224,0,0,.08)',
  onPrimary: '#fff',
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1EEE8',
  surfaceRaised: '#FFFFFF',
  surfaceInverse: '#0B1A2C',
  onInverse: '#F4F6F9',
  textPrimary: '#0B1A2C',
  textSecondary: '#4B5A6C',
  textTertiary: '#8A95A3',
  divider: 'rgba(11,26,44,.08)',
  dividerStrong: 'rgba(11,26,44,.14)',
  positive: '#0D7A58',
  positiveSoft: 'rgba(13,122,88,.1)',
  warning: '#A35A00',
  warningSoft: 'rgba(163,90,0,.1)',
  critical: '#D0001A',
  criticalSoft: 'rgba(208,0,26,.08)',
  glass: 'rgba(255,255,255,.78)',
  glassLine: 'rgba(11,26,44,.06)',
  map: {
    land: '#EFECE6',
    water: '#CFDDE6',
    park: '#DFE6D6',
    major: '#FFFFFF',
    road: '#FBFAF7',
    street: '#F6F4EF',
    casing: '#E1DDD5',
    building: '#E4E0D8',
    buildingTop: '#EBE8E1',
    label: '#6B7685',
    route: '#0B1A2C',
  },
};

export const darkColors = {
  primary: '#FF2B2B',
  primaryHover: '#FF4646',
  primaryPressed: '#E00000',
  primarySoft: 'rgba(255,43,43,.14)',
  onPrimary: '#fff',
  bg: '#08131F',
  surface: '#0E1C2D',
  surfaceSubtle: '#13243A',
  surfaceRaised: '#172B44',
  surfaceInverse: '#EEF2F7',
  onInverse: '#0B1A2C',
  textPrimary: '#EEF2F7',
  textSecondary: '#A6B3C3',
  textTertiary: '#6D7E93',
  divider: 'rgba(255,255,255,.07)',
  dividerStrong: 'rgba(255,255,255,.13)',
  positive: '#3CCF9A',
  positiveSoft: 'rgba(60,207,154,.12)',
  warning: '#F0A83C',
  warningSoft: 'rgba(240,168,60,.12)',
  critical: '#FF5468',
  criticalSoft: 'rgba(255,84,104,.13)',
  glass: 'rgba(14,28,45,.78)',
  glassLine: 'rgba(255,255,255,.07)',
  map: {
    land: '#0D1B2B',
    water: '#07111C',
    park: '#10241F',
    major: '#22374F',
    road: '#1A2D43',
    street: '#15263A',
    casing: '#0A1624',
    building: '#142538',
    buildingTop: '#1A2E45',
    label: '#7D8EA3',
    route: '#EEF2F7',
  },
};

export const typography = {
  display: { fontFamily: 'Geist_600SemiBold', fontSize: 40, lineHeight: 44, letterSpacing: -1.4 },
  large: { fontFamily: 'Geist_600SemiBold', fontSize: 32, lineHeight: 38, letterSpacing: -.96 },
  title: { fontFamily: 'Geist_600SemiBold', fontSize: 26, lineHeight: 32, letterSpacing: -.65 },
  heading: { fontFamily: 'Geist_600SemiBold', fontSize: 20, lineHeight: 26, letterSpacing: -.36 },
  body: { fontFamily: 'Geist_400Regular', fontSize: 16, lineHeight: 23, letterSpacing: -.176 },
  bodyM: { fontFamily: 'Geist_500Medium', fontSize: 16, lineHeight: 22, letterSpacing: -.176 },
  sec: { fontFamily: 'Geist_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: -.154 },
  cap: { fontFamily: 'Geist_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  over: { fontFamily: 'Geist_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: .66, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { xs: 8, sm: 12, md: 18, lg: 24, xl: 30 };
export const animation = {
  micro: 150,
  component: 210,
  sheet: 280,
  pop: 320,
  fade: 240,
  pressIn: 100,
  pressScale: .96,
  aiPulse: 1500,
  aiStagger: 280,
  easeOut: [.2, .8, .2, 1] as const,
  easeSpring: [.34, 1.32, .52, 1] as const,
  easeIO: [.65, 0, .35, 1] as const,
};

/** Locked SNAR customer dock specification. */
export const dock = {
  inset: 16,
  bottom: 22,
  height: 74,
  radius: 28,
  padding: 6,
  itemWidth: 64,
  itemHeight: 56,
  itemRadius: 18,
  aiSize: 62,
  aiRadius: 31,
  aiLift: 12,
  aiHaloSize: 72,
  labelSize: 11,
  labelLineHeight: 14,
  aiLabelGap: 4,
};
export const sheet = { radius: 30, top: 10, horizontal: 20, bottom: 34,
  handleWidth: 36, handleHeight: 5, handleGap: 14 };
export const toggle = { width: 50, height: 30, thumb: 24, inset: 3, travel: 20 };
export const dockBottom = (safeBottom: number) => Math.max(dock.bottom, safeBottom + 6);

export const shadows = {
  elev1: '0 1px 2px rgba(11,26,44,.05), 0 0 0 1px rgba(11,26,44,.04)',
  elev2: '0 8px 24px -8px rgba(11,26,44,.14), 0 0 0 1px rgba(11,26,44,.04)',
  elev3: '0 -8px 40px -12px rgba(11,26,44,.18)',
};

export const darkShadows = {
  elev1: '0 0 0 1px rgba(255,255,255,.06)',
  elev2: '0 10px 30px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)',
  elev3: '0 -10px 40px -12px rgba(0,0,0,.7)',
};
