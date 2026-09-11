import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, makeStyles, radius } from '@/src/theme';

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
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
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
  const s = useStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Overline({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      style={{
        fontSize: 10,
        letterSpacing: 2.4,
        textTransform: 'uppercase',
        color: color || colors.accent,
        fontWeight: '600',
      }}
    >
      {children}
    </Text>
  );
}

export function Loader({ label }: { label?: string }) {
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
    height: 54,
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
  btnText: { fontSize: 16, fontWeight: '600', color: c.accentOn },
  card: {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.line,
    padding: 18,
  },
}));

export { font };
