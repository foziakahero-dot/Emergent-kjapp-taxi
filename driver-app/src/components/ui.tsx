import { Text } from '@/src/components/Typography';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { colors, font, makeStyles, radius, useColorTheme } from '@/src/theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  testID,
  style,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}) {
  useColorTheme();
  const s = useStyles();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        isPrimary && s.btnPrimary,
        variant === 'ghost' && s.btnGhost,
        isDanger && s.btnDanger,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.95 }] },
        style,
      ]}
    >
      {isPrimary && <FigmaGradient pointerEvents="none" colors={['#FF3B3B', '#FF0000']} style={{ position: 'absolute', inset: 0, borderRadius: 999 }} />}
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.accentOn : colors.accent} />
      ) : (
        <View style={s.btnRow}>
          {icon}
          <Text
            style={[
              s.btnText,
              isPrimary && { color: colors.accentOn },
              variant === 'ghost' && { color: colors.text },
              isDanger && { color: colors.danger },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  useColorTheme();
  const s = useStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Overline({ children, color }: { children: React.ReactNode; color?: string }) {
  useColorTheme();
  return (
    <Text
      style={{
        fontSize: 10,
        letterSpacing: 2.4,
        textTransform: 'uppercase',
        color: color || colors.accent,
        fontFamily: font.mono,
      }}
    >
      {children}
    </Text>
  );
}

export function Loader({ label }: { label?: string }) {
  useColorTheme();
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.accent} />
      {label ? (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  btn: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnPrimary: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  btnGhost: {
    backgroundColor: c.cardSubtle,
    borderWidth: 1,
    borderColor: c.line,
  },
  btnDanger: {
    backgroundColor: c.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 14, lineHeight: 20, letterSpacing: -0.28, fontWeight: '600', color: c.accentOn },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.line,
    padding: 18,
  },
}));

export { font };

