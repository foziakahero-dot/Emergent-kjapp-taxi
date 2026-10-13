import { Text } from '@/src/components/Typography';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Button } from '@/src/components/ui';
import { Icon } from '@/src/components/Icon';
import { apiError } from '@/src/lib/format';

export default function DriverLegalConsent() {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { acceptLegal, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!accepted) {
      setError('Du må godta sjåførvilkår og personvern for å fortsette.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await acceptLegal();
      const identityStatus = updated?.identity_verification_status || 'not_submitted';
      const identityGate = Boolean(updated?.identity_recheck_required) || identityStatus !== 'verified';
      router.replace(identityGate ? '/driver-identity' : '/(driver)/home');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace('/driver-login');
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
      <View>
        <Text style={s.eyebrow}>SNAR DRIVER · KONTO</Text>
        <Text style={s.title}>Før du går på skift</Text>
        <Text style={s.sub}>
          Godkjente sjåfører må bekrefte gjeldende SNAR-vilkår og personvern før appen kan starte posisjonsdeling eller motta turer. Deretter gjennomføres Selfie ID dersom enheten ikke allerede er verifisert.
        </Text>

        <View style={s.links}>
          <Pressable style={s.linkRow} onPress={() => Linking.openURL('https://snarapp.no/vilkar')}>
            <Icon name="file-text" size={19} color={colors.online} />
            <Text style={s.linkLabel}>Les sjåførvilkår</Text>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={[s.linkRow, s.linkBorder]} onPress={() => Linking.openURL('https://snarapp.no/personvern')}>
            <Icon name="shield" size={19} color={colors.online} />
            <Text style={s.linkLabel}>Les personvern</Text>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable
          style={s.consentRow}
          onPress={() => setAccepted((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          testID="driver-legal-consent-checkbox"
        >
          <View style={[s.checkbox, accepted && s.checkboxOn]}>
            <Text style={s.checkmark}>{accepted ? '✓' : ''}</Text>
          </View>
          <Text style={s.consentText}>Jeg godtar sjåførvilkårene og har lest personvernerklæringen.</Text>
        </Pressable>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      <View>
        <Button
          label="Godta og fortsett"
          onPress={submit}
          loading={busy}
          disabled={!accepted}
          testID="driver-legal-consent-submit"
        />
        <Pressable style={s.logout} onPress={signOut} testID="driver-legal-consent-logout">
          <Text style={s.logoutText}>Logg ut</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, justifyContent: 'space-between', backgroundColor: c.driverBg, paddingHorizontal: 24 },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  title: { color: c.text, fontFamily: font.display, fontSize: 30, marginTop: 10 },
  sub: { color: c.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 26 },
  links: { backgroundColor: c.driverCard, borderWidth: 1, borderColor: c.line, borderRadius: 18, overflow: 'hidden' },
  linkRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  linkBorder: { borderTopWidth: 1, borderTopColor: c.line },
  linkLabel: { color: c.text, fontFamily: font.medium, fontSize: 15, flex: 1 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22, minHeight: 50 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: c.online, borderColor: c.online },
  checkmark: { color: c.driverBg, fontSize: 15, fontWeight: '800' },
  consentText: { color: c.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: 10 },
  logout: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  logoutText: { color: c.textMuted, fontSize: 14 },
}));
