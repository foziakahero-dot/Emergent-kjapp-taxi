import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { Avatar } from '@/src/components/Avatar';
import { useAuth } from '@/src/context/AuthContext';
import { gdprApi, uploadApi } from '@/src/lib/api';
import { storage } from '@/src/utils/storage';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>((user as any)?.profile_photo_path || (user as any)?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const avatarStorageKey = user?.id ? `kjapp_profile_photo_${user.id}` : null;

  useEffect(() => {
    if (!avatarStorageKey) return;
    storage.getItem(avatarStorageKey).then((saved) => {
      if (saved) setAvatarPath(saved);
    }).catch(() => {});
  }, [avatarStorageKey]);

  const rows: { icon: IconName; label: string; sub: string; onPress: () => void; testID: string }[] = [
    { icon: 'card', label: 'Betaling', sub: 'Kort og betalingsmåter', onPress: () => router.push('/payment-methods'), testID: 'profile-payments' },
    { icon: 'map-pin', label: 'Lagrede steder', sub: 'Hjem, jobb og favoritter', onPress: () => router.push('/saved-places'), testID: 'profile-places' },
    { icon: 'shield', label: 'Personvern', sub: 'Data, eksport og kontosikkerhet', onPress: () => router.push('/settings'), testID: 'profile-privacy' },
    { icon: 'help', label: 'Hjelp og support', sub: 'Få hjelp med KJAPP', onPress: () => router.push('/settings'), testID: 'profile-help' },
    { icon: 'settings', label: 'Innstillinger', sub: 'Varsler, språk og preferanser', onPress: () => router.push('/settings'), testID: 'profile-settings' },
  ];

  const pickProfilePhoto = async () => {
    if (!user?.id || avatarUploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Tilgang til bilder', 'Gi KJAPP tilgang til bilder for å velge profilbilde.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setAvatarUploading(true);
    try {
      const uploaded = await uploadApi.profilePhoto(result.assets[0]);
      if (!uploaded?.storage_path) throw new Error('missing storage path');
      setAvatarPath(uploaded.storage_path);
      if (avatarStorageKey) await storage.setItem(avatarStorageKey, uploaded.storage_path);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Kunne ikke laste opp', 'Profilbildet kunne ikke lagres akkurat nå. Prøv igjen.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'SLETT') return;
    setDeleting(true);
    setDeleteError('');
    try {
      await gdprApi.delete();
      if (avatarStorageKey) await storage.removeItem(avatarStorageKey);
      await logout();
      router.replace('/login');
    } catch {
      setDeleteError('Kunne ikke slette kontoen akkurat nå. Prøv igjen.');
      setDeleting(false);
    }
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headerRow}>
          <View>
            <Text style={s.kicker}>KJAPP ACCOUNT</Text>
            <Text style={s.title}>Profil</Text>
          </View>
          <View style={s.logoPill}>
            <Text style={s.logo}>KJ<Text style={{ color: colors.accent }}>A</Text>PP</Text>
          </View>
        </View>

        <View style={s.identityCard} testID="profile-card">
          <Avatar
            name={user?.fullName || user?.email}
            uri={avatarPath}
            size={92}
            editable
            onPress={pickProfilePhoto}
            testID="profile-avatar"
          />
          <View style={s.photoEditRow}>
            {avatarUploading ? <ActivityIndicator size="small" color={colors.accent} /> : <Icon name="camera" size={13} color={colors.accent} />}
            <Text style={s.photoEditText}>{avatarUploading ? 'Laster opp…' : 'Endre profilbilde'}</Text>
          </View>
          <Text style={s.name}>{user?.fullName || 'KJAPP-bruker'}</Text>
          <Text style={s.email}>{user?.email}</Text>
          {user?.phone ? <Text style={s.phone}>{user.phone}</Text> : null}
          <View style={s.memberBadge}>
            <View style={s.memberDot} />
            <Text style={s.memberText}>KJAPP MEMBER</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>KONTO</Text>
        <View style={s.menu}>
          {rows.map((r, i) => (
            <Pressable key={r.label} style={[s.menuRow, i > 0 && s.menuBorder]} onPress={r.onPress} testID={r.testID}>
              <View style={s.menuIcon}><Icon name={r.icon} size={18} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{r.label}</Text>
                <Text style={s.menuSub}>{r.sub}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionLabel}>SIKKERHET</Text>
        <Pressable style={s.deleteAccount} onPress={() => setDeleteOpen(true)} testID="profile-delete-account">
          <View style={s.deleteIcon}><Icon name="x" size={18} color={colors.danger} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.deleteLabel}>Slett konto</Text>
            <Text style={s.deleteSub}>Permanent sletting av konto og personopplysninger</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.danger} />
        </Pressable>

        <Pressable style={s.logout} onPress={handleLogout} testID="profile-logout">
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
            <Pressable onPress={() => { setDeleteOpen(false); setConfirmText(''); setDeleteError(''); }} style={{ marginTop: 12, alignItems: 'center' }} testID="profile-delete-cancel">
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Avbryt</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  kicker: { color: c.accent, fontSize: 9, letterSpacing: 2.5, fontWeight: '700' },
  title: { fontFamily: font.display, fontSize: 31, color: c.text, marginTop: 2 },
  logoPill: { backgroundColor: c.cardSubtle, borderRadius: 999, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 8 },
  logo: { color: c.text, fontFamily: font.display, fontSize: 15, letterSpacing: 1 },
  identityCard: { backgroundColor: c.card, borderRadius: 28, borderWidth: 1, borderColor: c.lineStrong, padding: 26, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  photoEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 18 },
  photoEditText: { color: c.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  name: { color: c.text, fontFamily: font.display, fontSize: 24, marginTop: 12 },
  email: { color: c.textSecondary, fontSize: 13, marginTop: 5 },
  phone: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, backgroundColor: c.accentSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  memberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
  memberText: { color: c.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  sectionLabel: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 28, marginBottom: 9, marginLeft: 4 },
  menu: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  menuBorder: { borderTopWidth: 1, borderTopColor: c.line },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontSize: 14, fontWeight: '650' as any },
  menuSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  deleteAccount: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 20, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)' },
  deleteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' },
  deleteLabel: { color: c.danger, fontSize: 14, fontWeight: '700' },
  deleteSub: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,10,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 26, borderWidth: 1, borderColor: c.lineStrong, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 23, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 13, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
  deleteError: { color: c.danger, fontSize: 12, textAlign: 'center', marginTop: 10 },
}));
