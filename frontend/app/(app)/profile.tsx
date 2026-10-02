import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { gdprApi } from '@/src/lib/api';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const initials = (user?.fullName || user?.email || 'K')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const rows: { icon: IconName; label: string; onPress: () => void; testID: string }[] = [
    { icon: 'map-pin', label: 'Lagrede steder', onPress: () => router.push('/saved-places'), testID: 'profile-places' },
    { icon: 'card', label: 'Betalingsmåter', onPress: () => router.push('/payment-methods'), testID: 'profile-payments' },
    { icon: 'settings', label: 'Innstillinger', onPress: () => router.push('/settings'), testID: 'profile-settings' },
    { icon: 'help', label: 'Hjelp og support', onPress: () => Linking.openURL('https://kjappapp.no/help'), testID: 'profile-help' },
  ];

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'SLETT') return;
    setDeleting(true);
    setDeleteError('');
    try {
      await gdprApi.delete();
      await logout();
      router.replace('/');
    } catch {
      setDeleteError('Kunne ikke slette kontoen akkurat nå. Prøv igjen.');
      setDeleting(false);
    }
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingTop: insets.top + 38, paddingBottom: 120 }}
      >
        <Text style={s.title}>Profil</Text>

        <View style={s.card} testID="profile-card">
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.fullName || 'KJAPP-bruker'}</Text>
            <Text style={s.email} numberOfLines={1}>{user?.phone || user?.email}</Text>
          </View>
        </View>

        <View style={s.menu}>
          {rows.map((r) => (
            <Pressable key={r.label} style={s.menuRow} onPress={r.onPress} testID={r.testID}>
              <View style={s.menuIcon}><Icon name={r.icon} size={18} color={colors.accent} /></View>
              <Text style={s.menuLabel}>{r.label}</Text>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={s.deleteAccount} onPress={() => setDeleteOpen(true)} testID="profile-delete-account">
          <View style={s.deleteIcon}><Icon name="x" size={18} color={colors.danger} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.deleteLabel}>Slett konto</Text>
            <Text style={s.deleteSub}>Slett KJAPP-kontoen og personopplysningene dine permanent</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.danger} />
        </Pressable>

        <Pressable style={s.logout} onPress={logout} testID="profile-logout">
          <Icon name="log-out" size={18} color={colors.danger} />
          <Text style={s.logoutText}>Logg ut</Text>
        </Pressable>
      </ScrollView>

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
  title: { fontFamily: font.semibold, fontSize: 24, color: c.text, marginBottom: 20, letterSpacing: -0.5 },
  card: { minHeight: 96, flexDirection: 'row', gap: 16, backgroundColor: c.card, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 18, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 20 },
  name: { color: c.text, fontFamily: font.semibold, fontSize: 18 },
  email: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
  menu: { marginTop: 12, gap: 10 },
  menuRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontFamily: font.semibold, fontSize: 14, flex: 1 },
  deleteAccount: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 20, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.line },
  deleteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { color: c.danger, fontSize: 15, fontWeight: '700' },
  deleteSub: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
  deleteError: { color: c.danger, fontSize: 12, textAlign: 'center', marginTop: 10 },
}));
