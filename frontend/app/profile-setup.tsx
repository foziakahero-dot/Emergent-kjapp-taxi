import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { DesignField } from '@/src/components/DesignField';
import { Rise } from '@/src/components/Motion';
import { KjappMark } from '@/src/components/KjappMark';
import { Icon } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { mePlacesApi, paymentApi } from '@/src/lib/api';
import { colors, font, useColorTheme, themedStyles } from '@/src/theme';

const PAYMENTS = [['apple', 'Apple Pay'], ['gpay', 'Google Pay'], ['vipps', 'Vipps'], ['card', 'Kort']] as const;
export default function ProfileSetup() {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const places = useQuery({ queryKey: ['me-places'], queryFn: mePlacesApi.list });
  const payments = useQuery({ queryKey: ['payment-methods'], queryFn: paymentApi.list });
  const methods = payments.data?.payment_methods || payments.data?.methods || (Array.isArray(payments.data) ? payments.data : []);
  const selectedMethod = methods.find((method: any) => method.is_default) || methods[0];
  const selected = selectedMethod?.type === 'vipps' ? 'vipps' : selectedMethod ? 'card' : undefined;
  return <View style={{ flex: 1 }}>
    <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }}>
      <KjappMark size={44} />
      <Rise><Text style={s.title}>Sett opp profilen</Text></Rise>
      <Rise><Text style={s.sub}>Så vi kan gjøre hver tur raskere for deg.</Text></Rise>
      <View style={{ marginTop: 32, gap: 20 }}>
        <DesignField label="Navn" value={user?.fullName || ''} placeholder="Fornavn Etternavn" editable={false} testID="setup-name" />
        <View>
          <Text style={s.label}>Betalingsmåte</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PAYMENTS.map(([id, label]) => {
              const active = id === selected;
              // Wallet/Vipps provisioning remains gated by the existing payment screen.
              return <Pressable key={id} onPress={() => router.push('/payment-methods')} testID={`setup-payment-${id}`} accessibilityRole="button" accessibilityState={{ selected: active }} style={({ pressed }) => [s.payment, { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.accent : colors.lineStrong }, pressed && { transform: [{ scale: 0.95 }] }]}><Text style={{ fontSize: 14, fontFamily: font.semibold, color: active ? colors.accent : colors.text }}>{label}</Text></Pressable>;
            })}
          </View>
        </View>
        <View>
          <Text style={s.label}>Faste adresser</Text>
          <View style={{ gap: 8 }}>
            {(['Hjem', 'Jobb'] as const).map(label => <Pressable key={label} onPress={() => router.push({ pathname: '/saved-places', params: { label } })} testID={`setup-place-${label}`} style={s.address} accessibilityRole="button" accessibilityLabel={`Endre ${label}`}>
              <Icon name={label === 'Hjem' ? 'home' : 'briefcase'} size={20} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 15, color: places.data?.places?.find((place: any) => place.label === label) ? colors.text : colors.textMuted }} numberOfLines={1}>{places.data?.places?.find((place: any) => place.label === label)?.name || label}</Text>
            </Pressable>)}
          </View>
        </View>
      </View>
      <Button label="Fullfør" onPress={() => router.replace('/(app)/home')} testID="setup-finish" style={{ marginTop: 32 }} />
      <Pressable onPress={() => router.replace('/(app)/home')} style={{ marginTop: 12, alignItems: 'center' }} testID="setup-skip"><Text style={{ color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 }}>Hopp over for nå</Text></Pressable>
    </ScrollView>
  </View>;
}
const s = themedStyles(() => StyleSheet.create({
  title: { marginTop: 24, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.48, color: colors.text },
  sub: { marginTop: 4, color: colors.textSecondary, fontSize: 14 },
  label: { marginBottom: 8, fontFamily: font.mono, fontSize: 10, letterSpacing: 2.4, color: colors.textMuted, textTransform: 'uppercase' },
  payment: { width: '48%', flexGrow: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  address: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 },
}));
