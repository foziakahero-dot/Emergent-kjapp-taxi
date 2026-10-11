import React, { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps, type TextStyle } from 'react-native';
import { colors, font } from '@/src/theme';

const weights: Record<string, string> = {
  '300': 'Geist_300Light', '400': 'Geist_400Regular', '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold', '700': 'Geist_700Bold', '800': 'Geist_800ExtraBold',
  normal: 'Geist_400Regular', bold: 'Geist_700Bold',
};
const TypographyContext = createContext<{ family: string; color: TextStyle['color']; size: number }>({ family: font.body, color: colors.text, size: 14 });
const lineHeights: Record<number, number> = { 9: 13.5, 10: 15, 11: 16.5, 12: 16, 14: 20, 15: 22.5, 16: 24, 18: 28, 20: 28, 24: 32, 30: 36, 36: 40, 60: 60 };

/** Use the actual font files, rather than Android/iOS synthetic font weights. */
export function resolveFont(style: TextStyle, inherited = font.body): TextStyle {
  let family = style.fontFamily || inherited;
  if (style.fontWeight && (family.startsWith('Geist_') || family === 'Geist')) {
    family = weights[String(style.fontWeight)] || family;
  } else if (style.fontWeight && family.startsWith('JetBrainsMono')) {
    family = ['normal', '300', '400'].includes(String(style.fontWeight)) ? font.mono : font.monoMedium;
  }
  return {
    fontFamily: family,
    ...(family.startsWith('Geist_') || family.startsWith('JetBrainsMono') ? { fontWeight: 'normal' as const } : {}),
    includeFontPadding: false,
  };
}

export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const inherited = useContext(TypographyContext);
  const flattened = StyleSheet.flatten(style) || {};
  const size = flattened.fontSize ?? inherited.size;
  const resolved = { ...resolveFont(flattened, inherited.family), color: flattened.color ?? inherited.color, lineHeight: flattened.lineHeight ?? lineHeights[size] ?? size * 1.5 };
  return (
    <TypographyContext.Provider value={{ family: resolved.fontFamily || inherited.family, color: resolved.color, size }}>
      <NativeText {...props} ref={ref} style={[style, resolved]} />
    </TypographyContext.Provider>
  );
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const resolved = resolveFont(StyleSheet.flatten(style) || {});
  return <NativeTextInput {...props} ref={ref} style={[style, resolved]} />;
});
