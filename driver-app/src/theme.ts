import { useMemo, useSyncExternalStore } from 'react';
import { storage } from '@/src/utils/storage';
import { Appearance, StyleSheet } from 'react-native';
import { Geist_300Light } from '@expo-google-fonts/geist/300Light';
import { Geist_800ExtraBold } from '@expo-google-fonts/geist/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';

/** SNAR V10 Driver — Geist typography and warm-neutral surfaces with truthful status colors. */
const lightColors = {
  glass: 'rgba(255,255,255,.78)',
  glassLine: 'rgba(11,26,44,.06)',
  positiveSoft: 'rgba(13,122,88,.1)',
  warningSoft: 'rgba(163,90,0,.1)',
  elevation1: '0 1px 2px rgba(11,26,44,.05), 0 0 0 1px rgba(11,26,44,.04)',
  elevation2: '0 8px 24px -8px rgba(11,26,44,.14), 0 0 0 1px rgba(11,26,44,.04)',
  elevation3: '0 -8px 40px -12px rgba(11,26,44,.18)',
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardSubtle: '#F1EEE8',
  elevated: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
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
  mapWater: '#CFDDE6',
  mapRoad: '#FFFFFF',
  mapRoadMajor: '#FBFAF7',
  mapBuilding: '#E4E0D8',
  driverBg: '#F7F5F1',
  driverCard: '#FFFFFF',
};

export type ThemeColors = typeof lightColors;
const darkColors: ThemeColors = {
  ...lightColors, bg: '#08131F', surface: '#0E1C2D', card: '#0E1C2D', cardSubtle: '#13243A', elevated: '#172B44', surfaceRaised: '#172B44',
  surfaceInverse: '#EEF2F7', onInverse: '#0B1A2C', line: 'rgba(255,255,255,.07)', lineStrong: 'rgba(255,255,255,.13)',
  text: '#EEF2F7', textSecondary: '#A6B3C3', textMuted: '#6D7E93', accent: '#FF2B2B', accentHover: '#FF4646', accentDim: '#E00000',
  accentSoft: 'rgba(255,43,43,.14)', accentGlow: 'rgba(255,43,43,.18)', success: '#3CCF9A', online: '#3CCF9A',
  positiveSoft: 'rgba(60,207,154,.12)', onlineSoft: 'rgba(60,207,154,.12)', warning: '#F0A83C', warningSoft: 'rgba(240,168,60,.12)',
  danger: '#FF5468', dangerSoft: 'rgba(255,84,104,.13)', glass: 'rgba(14,28,45,.78)', glassLine: 'rgba(255,255,255,.07)',
  elevation1: '0 0 0 1px rgba(255,255,255,.06)', elevation2: '0 10px 30px -10px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)', elevation3: '0 -10px 40px -12px rgba(0,0,0,.7)',
  driverBg: '#08131F', driverCard: '#0E1C2D', route: '#EEF2F7', mapCanvas: '#0D1B2B', mapWater: '#07111C', mapRoad: '#1A2D43', mapRoadMajor: '#22374F', mapBuilding: '#142538',
};
export type ColorThemeMode = 'light' | 'dark' | 'system';
export const COLOR_THEME_KEY = 'snar_driver_color_theme_v1';
let systemDark = Appearance?.getColorScheme?.() === 'dark';
const defaultMode: ColorThemeMode = 'dark';
function palette(mode: ColorThemeMode) { return (mode === 'dark' || (mode === 'system' && systemDark)) ? darkColors : lightColors; }
let themeSnapshot: { mode: ColorThemeMode; effective: 'light' | 'dark'; ready: boolean; palette: ThemeColors } = { mode: defaultMode, effective: (palette(defaultMode) === darkColors ? 'dark' : 'light') as 'light' | 'dark', ready: false, palette: palette(defaultMode) };
let loading: Promise<void> | undefined, saving = false, nativeSubscription: ReturnType<typeof Appearance.addChangeListener> | undefined;
const themeListeners = new Set<() => void>();
function publishTheme(mode: ColorThemeMode, ready = true) {
  const selected = palette(mode);
  themeSnapshot = { mode, effective: selected === darkColors ? 'dark' : 'light', ready, palette: selected };
  themeListeners.forEach(listener => listener());
}
async function loadColorTheme() {
  try { const value = await storage.getItem(COLOR_THEME_KEY); publishTheme(value === 'dark' || value === 'light' || value === 'system' ? value : defaultMode); }
  catch { publishTheme(defaultMode); }
}
function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  if (themeListeners.size === 1 && Appearance?.addChangeListener) nativeSubscription = Appearance.addChangeListener(({ colorScheme }) => {
    systemDark = colorScheme === 'dark';
    if (themeSnapshot.mode === 'system') publishTheme('system', themeSnapshot.ready);
  });
  if (!loading) loading = loadColorTheme();
  return () => { themeListeners.delete(listener); if (!themeListeners.size) { nativeSubscription?.remove(); nativeSubscription = undefined; } };
}
export function useColorTheme() { return useSyncExternalStore(subscribeTheme, () => themeSnapshot, () => themeSnapshot); }
export async function saveColorThemeMode(mode: ColorThemeMode) {
  if (!themeSnapshot.ready || saving) return false;
  saving = true;
  try { await storage.setItem(COLOR_THEME_KEY, mode); publishTheme(mode); return true; }
  finally { saving = false; }
}
// Compatibility for existing color imports: immutable palettes, resolved at render time.
// Components subscribe with useColorTheme; style factories are cached per palette.
export const colors: ThemeColors = new Proxy(lightColors, { get: (_target, key) => Reflect.get(themeSnapshot.palette, key) });
export function themedStyles<T extends object>(factory: () => T): T {
  let selected: ThemeColors | undefined, styles: T;
  const current = () => { if (selected !== themeSnapshot.palette) { selected = themeSnapshot.palette; styles = factory(); } return styles!; };
  return new Proxy({} as T, { get: (_target, key) => Reflect.get(current(), key), ownKeys: () => Reflect.ownKeys(current()), getOwnPropertyDescriptor: (_target, key) => ({ configurable: true, enumerable: true, value: Reflect.get(current(), key) }) });
}

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
  const selected = useColorTheme();
  return { colors: selected.palette, font, radius, spacing, motion };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: ThemeColors) => T,
) {
  return function useStyles(): T {
    const selected = useColorTheme();
    return useMemo(() => StyleSheet.create(factory(selected.palette)), [selected.palette]);
  };
}
