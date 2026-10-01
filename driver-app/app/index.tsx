import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { BrandBadge } from '@/src/components/BrandBadge';

export default function Index() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    if (user?.role === 'driver' && user?.approved === true && user?.legal_accepted === true) {
      const identityStatus = user.identity_verification_status || '';
      const mustRecheck = Boolean(user.identity_recheck_required)
        || ['recheck_required', 'retry_required', 'pending_review'].includes(identityStatus);
      router.replace(mustRecheck ? '/driver-identity' : '/(driver)/home');
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
  const s = useStyles();
  return (
    <View style={s.brandMark}>
      <View style={s.markHalo}><BrandBadge size={96} /></View>
      <Text style={s.wordmark}>KJAPP</Text>
      <Text style={s.driverWord}>DRIVER</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center' },
  markHalo: { width: 132, height: 132, borderRadius: 38, borderWidth: 1, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  wordmark: { color: c.text, fontFamily: font.display, fontSize: 52, letterSpacing: -2, marginTop: 24 },
  driverWord: { color: c.online, fontFamily: font.bold, fontSize: 11, letterSpacing: 4, marginTop: 2 },
  tag: { color: c.accent, fontFamily: font.semibold, fontSize: 10, letterSpacing: 3, marginTop: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 320 },
}));
