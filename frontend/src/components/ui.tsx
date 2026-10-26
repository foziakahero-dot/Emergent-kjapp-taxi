import { Button as SourceButton } from './snar10/Button';
import { Text } from '@/src/components/Typography';
import React from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';

export function Button({ label, onPress, variant = 'primary', loading, disabled, testID, style, icon }: {
  label: string; onPress?: () => void; variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean;
  testID?: string; style?: StyleProp<ViewStyle>; icon?: React.ReactNode;
}) {
  return <SourceButton label={label} onPress={onPress} kind={variant} busy={loading} disabled={disabled} testID={testID} style={style} icon={icon} />;
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
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: .66,
        textTransform: 'uppercase',
        color: color || colors.textMuted,
        fontFamily: font.semibold,
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

const useStyles = makeStyles(c => ({
  card: { backgroundColor: c.surface, borderRadius: 22, padding: 18, boxShadow: c.elevation1 },
}));

export { font };
