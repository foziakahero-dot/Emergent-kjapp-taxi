import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme } from '@/src/theme';
export function Chip({ label, icon, onPress, height = 36, disabled = false, testID, style }: {
  label: string; icon?: string; onPress?: () => void; height?: number; disabled?: boolean; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  useColorTheme();
  const content = <>{icon ? <V10Icon name={icon} size={18} /> : null}<Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20 }}>{label}</Text></>;
  const base: ViewStyle = { height, borderRadius: 12, backgroundColor: colors.cardSubtle, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: disabled ? .5 : 1 };
  return onPress ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [base, style, { transform: [{ scale: pressed ? .97 : 1 }] }]}>{content}</Pressable> : <View testID={testID} style={[base, style]}>{content}</View>;
}
