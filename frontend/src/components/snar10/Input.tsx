import React from 'react';
import { View, type TextInputProps } from 'react-native';
import { Text, TextInput } from '@/src/components/Typography';
import { colors, useColorTheme } from '@/src/theme';
import { typography } from '@/src/theme/snar10';

export function Input({ label, action, style, ...props }: TextInputProps & { label: string; action?: React.ReactNode }) {
  useColorTheme();
  return <View>
    <Text style={[typography.cap, { color: colors.textMuted, marginBottom: 8 }]}>{label}</Text>
    <View style={{ minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong,
      backgroundColor: colors.cardSubtle, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} placeholderTextColor={colors.textMuted}
        style={[typography.body, { color: colors.text, flex: 1, paddingVertical: 12, minWidth: 0 }, style]} />
      {action}
    </View>
  </View>;
}
