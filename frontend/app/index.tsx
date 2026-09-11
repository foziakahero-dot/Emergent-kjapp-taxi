import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();

  useEffect(() => {
    if (!user) return;
    if (user.role === 'driver') router.replace('/(driver)/home');
    else router.replace('/(app)/home');
  }, [user, router]);

  if (user === undefined || user) {
    return (
      <View style={s.splash}>
        <BrandMark />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
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
      <View style={{ gap: 18 }}>
        <Button label="Kom i gang" onPress={() => router.push('/login')} testID="onboarding-next" />
        <Pressable onPress={() => router.push('/driver-login')} testID="onboarding-driver-link" style={s.driverLink}>
          <Text style={s.driverLinkText}>Er du sjåfør?</Text>
        </Pressable>
      </View>
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
  subtitle: { color: c.textSecondary, fontFamily: font.display, fontSize: 19, marginTop: 40 },
  driverLink: { alignItems: 'center', paddingVertical: 8 },
  driverLinkText: { color: c.accent, fontSize: 13 },
}));
