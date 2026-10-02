import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { KjappMark } from '@/src/components/KjappMark';

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
      <Button label="Kom i gang" onPress={() => router.push('/permissions')} testID="onboarding-next" />
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
          <KjappMark size={104} />
        </Animated.View>
      </View>
      <Text style={s.wordmark} testID="ob-brand">KJAPP</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  splash: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center' },
  markStage: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 104, height: 104, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(255,0,0,0.35)' },
  wordmark: { color: c.text, fontFamily: font.bold, fontSize: 54, letterSpacing: -2.2, marginTop: 22 },
  tag: { color: c.accent, fontFamily: font.semibold, fontSize: 10, letterSpacing: 3, marginTop: 4 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
  subtitle: { color: c.textSecondary, fontFamily: font.body, fontSize: 16, lineHeight: 24, marginTop: 14, textAlign: 'center' },
}));
