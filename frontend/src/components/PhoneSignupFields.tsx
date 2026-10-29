import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';

type Props = {
  name: string; email: string; accepted: boolean; disabled: boolean;
  onName: (value: string) => void; onEmail: (value: string) => void;
  onAccepted: (value: boolean) => void;
};

export function PhoneSignupFields(p: Props) {
  useColorTheme();
  const input = { minHeight: 56, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: colors.lineStrong, backgroundColor: colors.cardSubtle,
    color: colors.text, fontFamily: font.body, fontSize: 16 };
  return <View style={{ gap: 12 }} testID="phone-signup-fields">
    <TextInput testID="phone-signup-name" accessibilityLabel="Fullt navn" placeholder="Fullt navn"
      autoComplete="name" textContentType="name" autoCapitalize="words" value={p.name}
      onChangeText={p.onName} editable={!p.disabled} maxLength={100} style={input} />
    <TextInput testID="phone-signup-email" accessibilityLabel="E-post for kontoen" placeholder="E-post"
      autoComplete="email" textContentType="emailAddress" keyboardType="email-address"
      autoCapitalize="none" autoCorrect={false} value={p.email} onChangeText={p.onEmail}
      editable={!p.disabled} maxLength={254} style={input} />
    <Pressable testID="phone-signup-consent" accessibilityRole="checkbox"
      accessibilityState={{ checked: p.accepted, disabled: p.disabled }} disabled={p.disabled}
      onPress={() => p.onAccepted(!p.accepted)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 1,
        borderColor: p.accepted ? colors.accent : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text }}>{p.accepted ? '✓' : ''}</Text>
      </View>
      <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>Jeg godtar vilkårene og har lest personvernerklæringen.</Text>
    </Pressable>
  </View>;
}
