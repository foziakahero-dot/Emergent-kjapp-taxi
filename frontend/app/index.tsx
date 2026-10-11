import { Text } from '@/src/components/Typography';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { SplashBackground, SplashBrand } from '@/src/components/SplashArt';
import { KjappMark } from '@/src/components/KjappMark';
import { Icon } from '@/src/components/Icon';

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
          <Text style={s.title}>Denne kontoen bruker en annen SNAR-app</Text>
          <Text style={s.subtitle}>
            Sjåfører logger inn i SNAR Driver. Admin- og flåtekontoer bruker sine egne portaler.
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
    <ScrollView contentContainerStyle={[s.onboarding, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} testID="onboarding">
      <SplashBackground />
      <KjappMark size={48} />
      <Text style={s.onboardingTitle}>Reis enkelt.{'\n'}<Text style={s.onboardingMuted}>Hele Norge.</Text></Text>
      <View style={s.benefits}>
        <Benefit icon="car" title="Lokale løyvehavere" detail="Godkjente sjåfører fra norske taxiselskaper." />
        <Benefit icon="card" title="Pris før du bestiller" detail="Se serverens turpris før du bekrefter." />
        <Benefit icon="sparkles" title="Si hva du trenger" detail="Bruk SNAR AI til å utforske reisemuligheter." />
      </View>
      <View style={s.onboardingActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/permissions')} testID="onboarding-next" style={s.primaryAction}>
          <Text style={s.primaryActionText}>Kom i gang</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/login')} testID="onboarding-login" style={s.secondaryAction}>
          <Text style={s.secondaryActionText}>Jeg har allerede konto</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Benefit({ icon, title, detail }: { icon: 'car' | 'card' | 'sparkles'; title: string; detail: string }) {
  const s = useStyles();
  return <View style={s.benefit}>
    <View style={s.benefitIcon}><Icon name={icon} size={20} color={colors.text} /></View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={s.benefitTitle}>{title}</Text>
      <Text style={s.benefitDetail}>{detail}</Text>
    </View>
  </View>;
}

const useStyles = makeStyles((c) => ({
    splash: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 28, justifyContent: 'center' },
    onboarding: { flexGrow: 1, backgroundColor: 'transparent', paddingHorizontal: 24 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontFamily: font.display, fontSize: 24, textAlign: 'center', marginTop: 32 },
    subtitle: { color: c.textSecondary, fontFamily: font.body, fontSize: 16, lineHeight: 24, marginTop: 14, textAlign: 'center' },
    onboardingTitle: { color: c.text, fontFamily: font.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1, marginTop: 32 },
    onboardingMuted: { color: c.textMuted, fontFamily: font.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
    benefits: { gap: 22, marginTop: 40 },
    benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    benefitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
    benefitTitle: { color: c.text, fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
    benefitDetail: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
    onboardingActions: { marginTop: 40, gap: 4 },
    primaryAction: { minHeight: 56, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    primaryActionText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
    secondaryAction: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    secondaryActionText: { color: c.text, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 }
}));
