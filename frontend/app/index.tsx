import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { BrandBadge } from '@/src/components/BrandBadge';

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
        <Text style={s.tag} testID="ob-tag">KUNDEAPP · NORGE</Text>
        <Text style={s.subtitle}>Bestill. Følg. Betal.</Text>
      </View>
      <Button label="Kom i gang" onPress={() => router.push('/login')} testID="onboarding-next" />
    </View>
  );
}

function BrandMark() {
  const s = useStyles();
  return (
    <View style={s.brandMark}>
      <View style={s.markHalo}><BrandBadge size={96} /></View>
      <Text style={s.wordmark} testID="ob-brand">KJAPP</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center' },
  markHalo: { width: 132, height: 132, borderRadius: 38, borderWidth: 1, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  wordmark: { color: c.text, fontFamily: font.display, fontSize: 52, letterSpacing: -2, marginTop: 24 },
  tag: { color: c.accent, fontFamily: font.semibold, fontSize: 10, letterSpacing: 3, marginTop: 4 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontFamily: font.body, fontSize: 16, lineHeight: 24, marginTop: 14, textAlign: 'center' },
}));
