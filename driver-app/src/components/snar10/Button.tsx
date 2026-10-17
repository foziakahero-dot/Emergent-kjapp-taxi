import React from 'react';
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';

export function Button({ label, onPress, kind = 'primary', small = false, disabled, busy, icon, testID, height, labelSize, iconSize, textColor, style }: {
  label: string; onPress?: () => void; kind?: 'primary' | 'danger' | 'ink' | 'soft' | 'ghost';
  small?: boolean; disabled?: boolean; busy?: boolean; icon?: React.ReactNode; testID?: string;
  height?: number; labelSize?: number; iconSize?: number; textColor?: string; style?: StyleProp<ViewStyle>;
}) {
  useColorTheme();
  const color = textColor ?? (kind === 'primary' || kind === 'danger' ? colors.accentOn : kind === 'ink' ? colors.onInverse : kind === 'ghost' ? colors.textSecondary : colors.text);
  const backgroundColor = { primary: colors.accent, danger: colors.danger, ink: colors.surfaceInverse, soft: colors.cardSubtle, ghost: 'transparent' }[kind];
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [{ minHeight: height ?? (small ? 44 : kind === 'ghost' ? 48 : 56),
      borderRadius: small ? 12 : 16, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor, opacity: disabled ? .5 : 1, boxShadow: kind === 'primary' ? `0 6px 20px -10px ${colors.accent}` : undefined,
      transform: [{ scale: pressed ? .97 : 1 }] }, style]}>
    {busy ? <ActivityIndicator color={color} /> : typeof icon === 'string' ? <V10Icon name={icon} color={color} size={iconSize ?? (small ? 18 : 22)} /> : icon ?? null}
    <Text style={{ color, fontFamily: font.semibold, fontSize: labelSize ?? (small ? 14 : 16),
      lineHeight: labelSize ? labelSize * 1.375 : small ? 20 : 22, letterSpacing: -.16 }}>{label}</Text>
  </Pressable>;
}
