import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';

const isCustomerRole = (role?: string) => !role || role === 'user' || role === 'customer';

export default function Index() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    if (user && isCustomerRole(user.role)) {
      router.replace(user.legal_accepted === true ? '/(app)/home' : '/legal-consent');
    }
  }, [user, router]);

  if (user === undefined || (user && isCustomerRole(user.role))) {
    return (
      <View style={s.splash}>
        <BrandMark />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      </View>
    );
  }

  if (user && !isCustomerRole(user.role)) {
    return (
      <View style={[s.splash, { paddingBottom: insets.bottom + 40, paddingTop: insets.top + 24 }]}>
        <View style={s.center}>
          <BrandMark />
          <Text style={s.title}>Denne kontoen bruker en annen KJAPP-app</Text>
          <Text style={s.subtitle}>
            Sjåfører logger inn i KJAPP Driver. Admin- og flåtekontoer bruker sine egne portaler.
          </Text>
        </View>
        <Button
          label="Logg ut"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
          testID="customer-role-logout"
        />
      </View>
    );
  }

  return (
    <View style={[s.splash, { paddingBottom: insets.bottom + 40, paddingTop: insets.top }]} testID="onboarding">
      <View style={s.center}>
        <BrandMark />
        <Text style={s.tag} testID="ob-tag">NORDIC TAXI</Text>
        <Text style={s.subtitle}>Enklere. Tryggere. Kjappere.</Text>
      </View>
      <Button label="Kom i gang" onPress={() => router.push('/login')} testID="onboarding-next" />
    </View>
  );
}

function BrandMark() {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontFamily: font.display, fontSize: 72, color: colors.text, letterSpacing: 1 }} testID="ob-brand">
        KJ<Text style={{ color: colors.accent }}>A</Text>PP
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tag: { color: c.accent, fontSize: 11, letterSpacing: 6, marginTop: 10 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontFamily: font.display, fontSize: 18, lineHeight: 25, marginTop: 24, textAlign: 'center' },
}));
