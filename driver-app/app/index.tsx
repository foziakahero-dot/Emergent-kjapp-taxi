import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';

export default function Index() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted === true) {
      router.replace('/(driver)/home');
    } else if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted !== true) {
      router.replace('/driver-legal-consent');
    }
  }, [user, router]);

  if (user === undefined || (user?.role === 'driver' && user?.approved === true)) {
    return (
      <View style={s.splash}>
        <BrandMark />
        <ActivityIndicator color={colors.online} style={{ marginTop: 28 }} />
      </View>
    );
  }

  if (user && (user.role !== 'driver' || user.approved !== true)) {
    const pendingApproval = user.role === 'driver' && user.approved !== true;
    return (
      <View style={[s.splash, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <View style={s.center}>
          <BrandMark />
          <Text style={s.title}>{pendingApproval ? 'Kontoen venter på godkjenning' : 'Denne appen er kun for sjåfører'}</Text>
          <Text style={s.subtitle}>
            {pendingApproval
              ? 'Du får tilgang til turer og posisjonsdeling når KJAPP har godkjent sjåførkontoen og dokumentasjonen.'
              : 'Logg ut og bruk en godkjent KJAPP-sjåførkonto.'}
          </Text>
        </View>
        <Button
          label="Logg ut"
          onPress={async () => {
            await logout();
            router.replace('/driver-login');
          }}
          testID="driver-role-logout"
        />
      </View>
    );
  }

  return (
    <View style={[s.splash, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]} testID="driver-onboarding">
      <View style={s.center}>
        <BrandMark />
        <Text style={s.tag}>DRIVER</Text>
        <Text style={s.subtitle}>Turer, navigasjon og inntekt — samlet i én sjåførapp.</Text>
      </View>
      <Button label="Logg inn som sjåfør" onPress={() => router.push('/driver-login')} testID="driver-onboarding-login" />
    </View>
  );
}

function BrandMark() {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: font.display, fontSize: 58, color: colors.text, letterSpacing: 1 }}>
        KJ<Text style={{ color: colors.accent }}>A</Text>PP
      </Text>
      <Text style={{ color: colors.online, fontSize: 13, letterSpacing: 5, marginTop: 4, fontWeight: '700' }}>
        DRIVER
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tag: { color: c.online, fontSize: 11, letterSpacing: 6, marginTop: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 320 },
}));
