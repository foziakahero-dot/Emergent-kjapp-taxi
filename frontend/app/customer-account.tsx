import { CustomerPhoto } from '@/src/components/CustomerPhoto';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text, TextInput } from '@/src/components/Typography';
import React, { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { googleIdentity } from '@/src/lib/socialSignIn';
import { apiError } from '@/src/lib/format';
import { authApi, gdprApi } from '@/src/lib/api';
import { CustomerSupport } from '@/src/components/CustomerSupport';
import { CustomerProfileDetails, type ProfileDetail } from '@/src/components/CustomerProfileDetails';

export default function CustomerAccount() {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [view, setView] = useState<'menu' | 'help' | ProfileDetail>('menu');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [deleteError, setDeleteError] = useState('');

  const googleLock = useRef(false);
  const [googleError, setGoogleError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const linkGoogle = async () => {
    if (googleLock.current) return;
    googleLock.current = true; setGoogleBusy(true); setGoogleError('');
    try {
      const identity = await googleIdentity(await authApi.nativeConfig());
      if (!identity) return;
      if (typeof identity !== 'string') throw new Error('Kontokobling må gjøres i mobilappen.');
      await authApi.linkGoogle(identity); await refresh();
    } catch (error) { setGoogleError(apiError(error)); }
    finally { googleLock.current = false; setGoogleBusy(false); }
  };
  const initials = (user?.fullName || user?.email || 'K')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const rows: { section: 'Steder' | 'Konto'; icon: IconName; label: string; sub: string; onPress: () => void; testID: string }[] = [
    { section: 'Steder', icon: 'home', label: 'Favorittadresser', sub: 'Hjem, Jobb og faste steder', onPress: () => router.push('/saved-places'), testID: 'profile-places' },
    { section: 'Konto', icon: 'shield', label: 'Sikkerhetssenter', sub: 'Nødkontakter, deling, verifisering', onPress: () => setView('safety'), testID: 'profile-safety' },
    { section: 'Konto', icon: 'card', label: 'Betaling og kvitteringer', sub: 'Apple Pay, Google Pay, kort', onPress: () => router.push('/payment-methods'), testID: 'profile-payments' },
    { section: 'Konto', icon: 'shield', label: 'Personvern', sub: 'Samtykker, data, GDPR', onPress: () => setView('privacy'), testID: 'profile-privacy' },
    { section: 'Konto', icon: 'sparkles', label: 'Kundestøtte', sub: 'AI-assistent, kontakt oss, kode/reward', onPress: () => setView('help'), testID: 'profile-help' },
    { section: 'Konto', icon: 'globe', label: 'Språk og tilgjengelighet', sub: 'Norsk · Stor tekst · Høykontrast', onPress: () => setView('language'), testID: 'profile-language' },
    { section: 'Konto', icon: 'settings', label: 'Innstillinger', sub: 'Turvarsler, personvern og appversjon', onPress: () => router.push('/settings'), testID: 'profile-settings' },
  ];

  const deleteAccount = async () => {
    if (deleteLock.current || confirmText.trim().toUpperCase() !== 'SLETT') return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await gdprApi.delete();
      await logout();
      router.replace('/');
    } catch {
      setDeleteError('Kunne ikke slette kontoen akkurat nå. Prøv igjen.');
      setDeleting(false);
    } finally { deleteLock.current = false; }
  };

  return (
    <>
      {view === 'help' ? <CustomerSupport onBack={() => setView('menu')} /> : view !== 'menu' ? <CustomerProfileDetails view={view} onBack={() => setView('menu')} onDelete={() => setDeleteOpen(true)} onSupport={() => setView('help')} /> : <View style={{ flex: 1 }}>
      <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 112 }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Tilbake" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: "center" }}><Text>‹ Tilbake</Text></Pressable>
        <View style={s.profileHeader} testID="profile-card">
          <CustomerPhoto initials={initials} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.fullName || 'SNAR-bruker'}</Text>
            <Text style={s.email} numberOfLines={2}>{[user?.phone, user?.email].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        {Platform.OS !== 'web' ? <Pressable testID="profile-link-google" accessibilityRole="button" disabled={googleBusy || user?.google_linked} onPress={() => void linkGoogle()} style={s.googleRow}><Text>{user?.google_linked ? 'Google-konto koblet' : googleBusy ? 'Kobler Google…' : 'Koble Google-konto'}</Text></Pressable> : null}
          {googleError ? <Text testID="profile-link-google-error" accessibilityRole="alert" style={{ color: colors.danger }}>{googleError}</Text> : null}
        {(['Steder', 'Konto'] as const).map((section) => (
          <View key={section} style={s.section}>
            <Text style={s.sectionTitle}>{section}</Text>
            <View style={s.menu}>
              {rows.filter((row) => row.section === section).map((r) => (
                <Pressable key={r.label} style={s.menuRow} onPress={r.onPress} testID={r.testID}>
                  <View style={s.menuIcon}><Icon name={r.icon} size={20} color={colors.text} /></View>
                  <View style={{ flex: 1 }}><Text style={s.menuLabel}>{r.label}</Text><Text style={{ fontSize: 12, color: colors.textSecondary }}>{r.sub}</Text></View>
                  <Icon name="chevron-right" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable style={s.logout} onPress={logout} testID="profile-logout">
          <Text style={s.logoutText}>Logg ut</Text>
        </Pressable>
      </ScrollView>
      </View>}

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}><Icon name="shield" size={24} color={colors.danger} /></View>
            <Text style={s.modalTitle}>Slette kontoen din?</Text>
            <Text style={s.modalBody}>Dette kan ikke angres. Skriv «SLETT» for å bekrefte permanent sletting.</Text>
            <TextInput
              testID="profile-delete-confirm-input"
              placeholder="SLETT"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={confirmText}
              onChangeText={setConfirmText}
              style={s.modalInput}
            />
            {deleteError ? <Text style={s.deleteError}>{deleteError}</Text> : null}
            <Button
              label="Slett konto permanent"
              variant="danger"
              onPress={deleteAccount}
              loading={deleting}
              disabled={confirmText.trim().toUpperCase() !== 'SLETT'}
              testID="profile-delete-confirm"
              style={{ marginTop: 14 }}
            />
            <Pressable
              onPress={() => {
                setDeleteOpen(false);
                setConfirmText('');
                setDeleteError('');
              }}
              style={{ marginTop: 12, alignItems: 'center' }}
              testID="profile-delete-cancel"
            >
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Avbryt</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  profileHeader: { flexDirection: 'row', gap: 16, marginVertical: 16, alignItems: 'center' },
  section: { marginTop: 20 },
  sectionTitle: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 20, letterSpacing: -0.4 },
  name: { color: c.text, fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.36 },
  email: { color: c.textSecondary, fontSize: 12 },
  menu: { gap: 1, paddingVertical: 4, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: c.surface },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  googleRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  menuLabel: { color: c.text, fontFamily: font.semibold, fontSize: 14, flex: 1 },
  logout: { alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingVertical: 14, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.accentSoft },
  logoutText: { color: c.accent, fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
  deleteError: { color: c.danger, fontSize: 12, textAlign: 'center', marginTop: 10 },
}));
