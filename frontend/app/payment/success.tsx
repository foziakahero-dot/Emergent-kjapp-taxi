import { Text } from '@/src/components/Typography';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paymentApi } from '@/src/lib/api';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Loader } from '@/src/components/ui';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentSuccess() {
  useColorTheme();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const [state, setState] = useState<'checking' | 'failed'>('checking');
  const [message, setMessage] = useState('Bekrefter betalingen…');
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!session_id) {
        setMessage('Mangler betalingsreferanse.');
        setState('failed');
        return;
      }

      for (let attempt = 0; attempt < 12 && active; attempt += 1) {
        try {
          const status = await paymentApi.checkoutStatus(session_id);
          if (!active) return;
          if (status?.trip_id) setTripId(status.trip_id);
          if (status?.payment_status === 'paid') {
            const paidTripId = status?.trip_id;
            router.replace(paidTripId ? `/receipt/${paidTripId}` : '/(app)/home');
            return;
          }
          if (status?.payment_status === 'failed' || status?.payment_status === 'expired') {
            setMessage('Betalingen ble ikke fullført.');
            setState('failed');
            return;
          }
        } catch {}
        await sleep(1500);
      }

      if (active) {
        setMessage('Betalingen er ikke bekreftet ennå. Gå tilbake til kvitteringen og sjekk på nytt — turen forblir åpen til serveren bekrefter betalingen.');
        setState('failed');
      }
    };

    verify();
    return () => { active = false; };
  }, [session_id, router]);

  return (
    <View style={[s.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {state === 'checking' ? (
        <>
          <Loader label={message} />
          <Text style={s.sub}>Dette tar vanligvis bare noen sekunder.</Text>
        </>
      ) : (
        <>
          <View style={s.icon}><Icon name="card" size={28} color={colors.accent} /></View>
          <Text style={s.title}>Betaling</Text>
          <Text style={s.sub}>{message}</Text>
          <Pressable
            style={s.button}
            onPress={() => router.replace(tripId ? `/receipt/${tripId}` : '/(app)/home')}
            testID="payment-success-back"
          >
            <Text style={s.buttonText}>{tripId ? 'Tilbake til kvittering' : 'Til hjem'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  page: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 25 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  button: { marginTop: 24, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 },
  buttonText: { color: c.accentOn, fontSize: 15, fontWeight: '800' },
}));

