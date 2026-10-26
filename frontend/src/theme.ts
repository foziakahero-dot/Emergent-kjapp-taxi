import { colors as sourceLight, darkColors as sourceDark, shadows as sourceShadows, darkShadows as sourceDarkShadows } from './theme/snar10';
import { useMemo, useSyncExternalStore } from 'react';
import { getAccessibilityPreferences, subscribeAccessibilityPreferences } from '@/src/lib/accessibilityPreferences';
import { storage } from '@/src/utils/storage';
import { Appearance, StyleSheet } from 'react-native';
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
const lightColors = {
  glass: sourceLight.glass,
  glassLine: sourceLight.glassLine,
  positiveSoft: sourceLight.positiveSoft,
  warningSoft: sourceLight.warningSoft,
  elevation1: sourceShadows.elev1,
  elevation2: sourceShadows.elev2,
  elevation3: sourceShadows.elev3,
  bg: sourceLight.bg,
  surface: sourceLight.surface,
  card: sourceLight.surface,
  cardSubtle: sourceLight.surfaceSubtle,
  elevated: sourceLight.surfaceRaised,
  surfaceInverse: sourceLight.surfaceInverse,
  onInverse: sourceLight.onInverse,
  surfaceRaised: sourceLight.surfaceRaised,
  line: sourceLight.divider,
  lineStrong: sourceLight.dividerStrong,
  text: sourceLight.textPrimary,
  textSecondary: sourceLight.textSecondary,
  textMuted: sourceLight.textTertiary,
  accent: sourceLight.primary,
  accentHover: sourceLight.primaryHover,
  accentDim: sourceLight.primaryPressed,
  accentSoft: sourceLight.primarySoft,
  accentGlow: 'rgba(224,0,0,0.18)',
  accentOn: sourceLight.onPrimary,
  success: sourceLight.positive,
  warning: sourceLight.warning,
  danger: sourceLight.critical,
  dangerSoft: sourceLight.criticalSoft,
  info: '#1A5FB4',
  online: sourceLight.positive,
  onlineSoft: '#E6F6F0',
  onlineGlow: 'rgba(13,122,88,0.18)',
  route: sourceLight.map.route,
  mapCanvas: sourceLight.map.land,
  mapWater: sourceLight.map.water,
  mapRoad: sourceLight.map.road,
  mapRoadMajor: sourceLight.map.major,
  mapBuilding: sourceLight.map.building,
  driverBg: '#08131F',
  driverCard: '#FFFFFF',
};

export type ThemeColors = typeof lightColors;
const darkColors: ThemeColors = {
  ...lightColors, bg: sourceDark.bg, surface: sourceDark.surface, card: sourceDark.surface, cardSubtle: sourceDark.surfaceSubtle, elevated: sourceDark.surfaceRaised, surfaceRaised: sourceDark.surfaceRaised,
  surfaceInverse: sourceDark.surfaceInverse, onInverse: sourceDark.onInverse, line: sourceDark.divider, lineStrong: sourceDark.dividerStrong,
  text: sourceDark.textPrimary, textSecondary: sourceDark.textSecondary, textMuted: sourceDark.textTertiary, accent: sourceDark.primary, accentHover: sourceDark.primaryHover, accentDim: sourceDark.primaryPressed,
  accentSoft: sourceDark.primarySoft, accentGlow: 'rgba(255,43,43,.18)', success: sourceDark.positive, online: sourceDark.positive,
  positiveSoft: sourceDark.positiveSoft, onlineSoft: 'rgba(60,207,154,.12)', warning: sourceDark.warning, warningSoft: sourceDark.warningSoft,
  danger: sourceDark.critical, dangerSoft: sourceDark.criticalSoft, glass: sourceDark.glass, glassLine: sourceDark.glassLine,
  elevation1: sourceDarkShadows.elev1, elevation2: sourceDarkShadows.elev2, elevation3: sourceDarkShadows.elev3,
  driverBg: '#08131F', driverCard: '#0E1C2D', route: sourceDark.map.route, mapCanvas: sourceDark.map.land, mapWater: sourceDark.map.water, mapRoad: sourceDark.map.road, mapRoadMajor: sourceDark.map.major, mapBuilding: sourceDark.map.building,
};
export type ColorThemeMode = 'light' | 'dark' | 'system';
export const COLOR_THEME_KEY = 'snar_customer_color_theme_v1';
let systemDark = Appearance?.getColorScheme?.() === 'dark';
const lightHighContrast: ThemeColors = { ...lightColors, textSecondary: '#26384B', textMuted: '#40536A', line: 'rgba(11,26,44,.35)', lineStrong: 'rgba(11,26,44,.65)' };
const darkHighContrast: ThemeColors = { ...darkColors, text: '#FFFFFF', textSecondary: '#E1E8F1', textMuted: '#BDCBDC', line: 'rgba(255,255,255,.35)', lineStrong: 'rgba(255,255,255,.65)' };
const defaultMode: ColorThemeMode = 'light';
function palette(mode: ColorThemeMode) { const dark = mode === 'dark' || (mode === 'system' && systemDark); return getAccessibilityPreferences().highContrast ? dark ? darkHighContrast : lightHighContrast : dark ? darkColors : lightColors; }
let themeSnapshot: { mode: ColorThemeMode; effective: 'light' | 'dark'; ready: boolean; palette: ThemeColors } = { mode: defaultMode, effective: (palette(defaultMode) === darkColors ? 'dark' : 'light') as 'light' | 'dark', ready: false, palette: palette(defaultMode) };
let accessibilitySubscription: (() => void) | undefined;
let loading: Promise<void> | undefined, saving = false, nativeSubscription: ReturnType<typeof Appearance.addChangeListener> | undefined;
const themeListeners = new Set<() => void>();
function publishTheme(mode: ColorThemeMode, ready = true) {
  const selected = palette(mode);
  themeSnapshot = { mode, effective: mode === 'dark' || (mode === 'system' && systemDark) ? 'dark' : 'light', ready, palette: selected };
  themeListeners.forEach(listener => listener());
}
async function loadColorTheme() {
  try { const value = await storage.getItem(COLOR_THEME_KEY); publishTheme(value === 'dark' || value === 'light' || value === 'system' ? value : defaultMode); }
  catch { publishTheme(defaultMode); }
}
function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  if (themeListeners.size === 1) accessibilitySubscription = subscribeAccessibilityPreferences(() => publishTheme(themeSnapshot.mode, themeSnapshot.ready));
  if (themeListeners.size === 1 && Appearance?.addChangeListener) nativeSubscription = Appearance.addChangeListener(({ colorScheme }) => {
    systemDark = colorScheme === 'dark';
    if (themeSnapshot.mode === 'system') publishTheme('system', themeSnapshot.ready);
  });
  if (!loading) loading = loadColorTheme();
  return () => { themeListeners.delete(listener); if (!themeListeners.size) { nativeSubscription?.remove(); nativeSubscription = undefined; accessibilitySubscription?.(); accessibilitySubscription = undefined; } };
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
