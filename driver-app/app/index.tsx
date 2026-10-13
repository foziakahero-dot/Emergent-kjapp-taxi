import { Text } from '@/src/components/Typography';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import DriverApproval from './driver-approval';
import { SplashAction, SplashBackground, SplashBrand } from '@/src/components/SplashArt';

export default function Index() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted === true) {
      const identityStatus = user.identity_verification_status || 'not_submitted';
      const identityGate = Boolean(user.identity_recheck_required) || identityStatus !== 'verified';
      router.replace(identityGate ? '/driver-approval' : '/(driver)/home');
    } else if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted !== true) {
      router.replace('/driver-legal-consent');
    }
  }, [user, router]);

  if (user === undefined || (user?.role === 'driver' && user?.approved === true)) {
    return (
      <View style={[s.splash, { backgroundColor: '#08131F' }]}>
        <SplashBackground inverse />
        <SplashBrand inverse label="Driver" />
      </View>
    );
  }

  if (user && (user.role !== 'driver' || user.approved !== true)) {
    const pendingApproval = user.role === 'driver' && user.approved !== true;
    if (pendingApproval) return <DriverApproval />;
    return (
      <View style={[s.splash, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <View style={s.center}>
          <SplashBrand />
          <Text style={s.title}>{pendingApproval ? 'Kontoen venter på godkjenning' : 'Denne appen er kun for sjåfører'}</Text>
          <Text style={s.subtitle}>
            {pendingApproval
              ? 'Du får tilgang til turer og posisjonsdeling når SNAR har godkjent sjåførkontoen og dokumentasjonen.'
              : 'Logg ut og bruk en godkjent SNAR-sjåførkonto.'}
          </Text>
        </View>
        {pendingApproval ? (
          <View style={{ gap: 10 }}>
            <Button
              label="Ta identitetsselfie"
              onPress={() => router.push('/driver-identity')}
              testID="driver-pending-identity"
            />
            <Button
              label="Logg ut"
              variant="ghost"
              onPress={async () => {
                await logout();
                router.replace('/driver-login');
              }}
              testID="driver-role-logout"
            />
          </View>
        ) : (
          <Button
            label="Logg ut"
            onPress={async () => {
              await logout();
              router.replace('/driver-login');
            }}
            testID="driver-role-logout"
          />
        )}
      </View>
    );
  }

  return (
    <View style={[s.splash, { paddingTop: insets.top, paddingBottom: insets.bottom, alignItems: 'center' }]} testID="driver-onboarding">
      <SplashBackground />
      <SplashBrand />
      <SplashAction label="Start vakt" onPress={() => router.push('/driver-login')} testID="driver-onboarding-login" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
    splash: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 28, justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
    subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 320 }
}));
