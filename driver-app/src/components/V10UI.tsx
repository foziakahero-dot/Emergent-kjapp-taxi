import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';

export function V10Screen({ children, dock = false, style, testID }: { children: React.ReactNode; dock?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  useColorTheme();
  const insets = useSafeAreaInsets();
  return <ScrollView testID={testID} style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled"
    contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: 20, paddingTop: Math.max(60, insets.top + 12), paddingBottom: insets.bottom + (dock ? 106 : 24) }, style]}>{children}</ScrollView>;
}
export function V10Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  useColorTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, marginBottom: 8 }}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Tilbake" onPress={onBack} style={{ width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="chevL" /></Pressable>}
    <Text style={{ flex: 1, textAlign: onBack ? 'center' : 'left', marginRight: onBack && !right ? 36 : 0, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 }}>{title}</Text>{right}
  </View>;
}
export function V10Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  useColorTheme();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden', boxShadow: colors.elevation1 }, style]}>{children}</View>;
}
export function V10Section({ title, children }: { title: string; children: React.ReactNode }) {
  useColorTheme();
  return <View style={{ marginTop: 24 }}><Text style={{ marginHorizontal: 4, marginBottom: 10, fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: .66, textTransform: 'uppercase', color: colors.textMuted }}>{title}</Text>{children}</View>;
}
export function V10Row({ icon, title, subtitle, right, onPress, border = false, testID, disabled = false }: {
  icon?: string; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; border?: boolean; testID?: string; disabled?: boolean;
}) {
  useColorTheme();
  const content = <>{border ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} /> : null}{icon ? <View style={v10.icon}><V10Icon name={icon} size={20} /></View> : null}<View style={{ flex: 1 }}>
    <Text style={v10.body}>{title}</Text>{subtitle ? <Text style={[v10.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
  </View>{right ?? (onPress ? <V10Icon name="chevR" size={18} color={colors.textMuted} /> : null)}</>;
  // Match the original prototype's computed button row padding (the scoped button reset overrides .s10-row).
  const style = [v10.row, onPress && { paddingVertical: 0, paddingHorizontal: 0 }];
  return onPress ? <Pressable accessibilityRole="button" testID={testID} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [...style, pressed && { backgroundColor: colors.cardSubtle }, disabled && { opacity: .55 }]}>{content}</Pressable> : <View testID={testID} style={style}>{content}</View>;
}
export function V10Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'positive' | 'warning' | 'critical' | 'neutral' }) {
  useColorTheme();
  const palette = { positive: [colors.success, colors.positiveSoft], warning: [colors.warning, colors.warningSoft], critical: [colors.danger, colors.dangerSoft], neutral: [colors.textSecondary, colors.cardSubtle] }[tone];
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: palette[1] }}>
    <View style={{ width: 6, height: 6, borderRadius: tone === 'positive' ? 3 : 2, backgroundColor: palette[0], transform: [{ rotate: tone === 'critical' ? '45deg' : '0deg' }] }} />
    <Text style={{ fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: palette[0] }}>{children}</Text>
  </View>;
}
export function V10Action({ label, onPress, kind = 'primary', small = false, disabled, busy, icon, testID, height, labelSize }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ink' | 'soft' | 'ghost'; small?: boolean; disabled?: boolean; busy?: boolean; icon?: string; testID?: string; height?: number; labelSize?: number;
}) {
  useColorTheme();
  const color = kind === 'primary' ? colors.accentOn : kind === 'ink' ? colors.onInverse : kind === 'ghost' ? colors.textSecondary : colors.text;
  const backgroundColor = { primary: colors.accent, ink: colors.surfaceInverse, soft: colors.cardSubtle, ghost: 'transparent' }[kind];
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => ({ minHeight: height ?? (small ? 44 : kind === 'ghost' ? 48 : 56), borderRadius: small ? 12 : 16, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor, opacity: disabled ? .5 : 1, boxShadow: kind === 'primary' ? `0 6px 20px -10px ${colors.accent}` : undefined, transform: [{ scale: pressed ? .97 : 1 }] })}>
    {busy ? <ActivityIndicator color={color} /> : icon ? <V10Icon name={icon} color={color} size={small ? 18 : 22} /> : null}
    <Text style={{ color, fontFamily: font.semibold, fontSize: labelSize ?? (small ? 14 : 16), lineHeight: labelSize ? labelSize * 1.375 : small ? 20 : 22, letterSpacing: -.16 }}>{label}</Text>
  </Pressable>;
}
export function V10State({ icon, title, body, action, onAction, warning = false }: { icon: string; title: string; body: string; action?: string; onAction?: () => void; warning?: boolean }) {
  useColorTheme();
  return <View style={{ gap: 20 }}>
    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: warning ? colors.warningSoft : colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name={icon} size={26} color={warning ? colors.warning : colors.text} /></View>
    <View><Text style={v10.heading}>{title}</Text><Text style={[v10.secondary, { marginTop: 6 }]}>{body}</Text></View>
    {action && onAction ? <V10Action label={action} onPress={onAction} kind="ink" small /> : null}
  </View>;
}
export const v10 = themedStyles(() => StyleSheet.create({
  title: { color: colors.text, fontFamily: font.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -.65 },
  heading: { color: colors.text, fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -.36 },
  body: { color: colors.text, fontFamily: font.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -.176 },
  secondary: { color: colors.textSecondary, fontFamily: font.body, fontSize: 14, lineHeight: 20, letterSpacing: -.154 },
  caption: { color: colors.textMuted, fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  overline: { color: colors.textMuted, fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: .66, textTransform: 'uppercase' },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 16 },
}));
