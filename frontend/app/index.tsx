import { Text } from '@/src/components/Typography';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { SplashAction, SplashBackground, SplashBrand } from '@/src/components/SplashArt';

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
        <SplashBackground />
        <SplashBrand />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      </View>
    );
  }

  if (user && !isCustomerRole(user.role)) {
    return (
      <View style={[s.splash, { paddingBottom: insets.bottom + 40, paddingTop: insets.top + 24 }]}>
        <View style={s.center}>
          <SplashBrand />
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
    <View style={[s.splash, { paddingTop: insets.top, paddingBottom: insets.bottom, alignItems: 'center' }]} testID="onboarding">
      <SplashBackground />
      <SplashBrand />
      <SplashAction label="Kom i gang" onPress={() => router.push('/permissions')} testID="onboarding-next" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
    splash: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 28, justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
    subtitle: { color: c.textSecondary, fontFamily: font.body, fontSize: 16, lineHeight: 24, marginTop: 14, textAlign: 'center' }
}));

