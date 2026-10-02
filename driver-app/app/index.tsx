import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
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
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 3000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    pulseLoop.start(); floatLoop.start();
    return () => { pulseLoop.stop(); floatLoop.stop(); };
  }, [float, pulse]);

  return (
    <View style={s.brandMark}>
      <View style={s.markStage}>
        <Animated.View style={[s.pulseRing, {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
        }]} />
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
          <BrandBadge size={104} />
        </Animated.View>
      </View>
      <Text style={s.wordmark}>KJAPP</Text>
      <Text style={s.driverWord}>DRIVER</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.driverBg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center' },
  markStage: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 104, height: 104, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(255,0,0,0.35)' },
  wordmark: { color: c.text, fontFamily: font.bold, fontSize: 54, letterSpacing: -2.2, marginTop: 22 },
  driverWord: { color: c.online, fontFamily: font.bold, fontSize: 11, letterSpacing: 4, marginTop: 2 },
  tag: { color: c.accent, fontFamily: font.semibold, fontSize: 10, letterSpacing: 3, marginTop: 18 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 320 },
}));
