import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';

export default function PaymentCancel() {
  const { trip_id } = useLocalSearchParams<{ trip_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  const back = () => {
    router.replace(trip_id ? `/receipt/${trip_id}` : '/(app)/home');
  };

  return (
    <View style={[s.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.icon}><Icon name="x" size={26} color={colors.text} /></View>
      <Text style={s.title}>Betalingen ble avbrutt</Text>
      <Text style={s.sub}>Ingen ny betaling ble registrert. Du kan gå tilbake til kvitteringen og prøve igjen.</Text>
      <Pressable style={s.button} onPress={back} testID="payment-cancel-back">
        <Text style={s.buttonText}>Tilbake til kvittering</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  page: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 25, textAlign: 'center' },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  button: { marginTop: 24, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: c.accentOn, fontSize: 15, fontWeight: '800' },
}));
