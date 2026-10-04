import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';
import { API_BASE, driverApi, TOKEN_KEY } from '@/src/lib/api';
import { vehicleMeta } from '@/src/lib/format';
import { storage } from '@/src/utils/storage';

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, refresh } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleBusy, setVehicleBusy] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const profileQuery = useQuery({ queryKey: ['driver-profile'], queryFn: driverApi.profile });
  const ratingsQuery = useQuery({ queryKey: ['driver-ratings'], queryFn: driverApi.ratings });

  useEffect(() => {
    storage.getItem(TOKEN_KEY).then(setToken).catch(() => setToken(null));
  }, []);

  const profile = profileQuery.data;
  const u = { ...(user || {}), ...(profile?.driver || {}) } as any;
  const ratings = ratingsQuery.data;
  const activeVehicle = profile?.active_vehicle || null;
  const assignedVehicles = Array.isArray(profile?.assigned_vehicles) ? profile.assigned_vehicles : [];
  const fleet = profile?.fleet || null;

  const initials = useMemo(
    () => (u.fullName || 'S').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase(),
    [u.fullName],
  );

  const photoSource = profile?.has_profile_photo && token
    ? {
        uri: `${API_BASE}/driver/profile-photo?v=${encodeURIComponent(u.updated_at || u.profile_photo_path || '1')}`,
        headers: { Authorization: `Bearer ${token}` },
      }
    : null;

  const pickProfilePhoto = async () => {
    setActionError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionError('Gi tilgang til bilder for å velge profilbilde.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'profile.jpg',
      type: asset.mimeType || 'image/jpeg',
    } as any);

    setPhotoBusy(true);
    try {
      await driverApi.uploadProfilePhoto(form);
      await Promise.all([
        profileQuery.refetch(),
        refresh(),
      ]);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || 'Kunne ikke laste opp profilbildet.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const selectVehicle = async (vehicleId: string) => {
    setActionError('');
    setVehicleBusy(vehicleId);
    try {
      await driverApi.selectVehicle(vehicleId);
      await Promise.all([
        profileQuery.refetch(),
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['driver-summary'] }),
      ]);
      setVehicleOpen(false);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || 'Kunne ikke velge bilen.');
    } finally {
      setVehicleBusy(null);
    }
  };

  const activeVehicleLabel = activeVehicle
    ? `${activeVehicle.car} · ${activeVehicle.plate}`
    : 'Ingen aktiv bil valgt';

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.driverBg }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <Text style={s.title}>Profil</Text>

        <View style={s.card}>
          <Pressable
            onPress={pickProfilePhoto}
            disabled={photoBusy}
            style={s.avatarWrap}
            testID="driver-profile-photo-action"
            accessibilityRole="button"
            accessibilityLabel="Endre profilbilde"
          >
            {photoSource ? (
              <Image source={photoSource} style={s.avatarImage} contentFit="cover" transition={120} />
            ) : (
              <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
            )}
            <View style={s.photoEdit}>
              <Icon name="plus" size={15} color={colors.text} />
            </View>
          </Pressable>

          <Text style={s.name}>{u.fullName || 'Sjåfør'}</Text>
          <Text style={s.email}>{u.email || u.phone || ''}</Text>
          <Text style={s.photoHint}>{photoBusy ? 'Laster opp…' : 'Trykk på bildet for å endre'}</Text>

          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Icon name="star" size={13} color={colors.accent} fill={colors.accent} />
              <Text style={s.badgeText}>
                {ratings?.count ? `${ratings.average} · ${ratings.count} turer` : 'Ingen vurderinger'}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: colors.onlineSoft }]}>
              <Icon name="check" size={13} color={colors.online} />
              <Text style={[s.badgeText, { color: colors.online }]}>
                {u.approved === true ? 'Godkjent' : 'Venter'}
              </Text>
            </View>
          </View>
        </View>

        {actionError ? <Text style={s.errorText} testID="driver-profile-error">{actionError}</Text> : null}

        <Text style={s.section}>Kjører for</Text>
        <View style={s.infoCard}>
          <Info label="Firma" value={fleet?.name || 'Ingen flåte tilknyttet'} s={s} testID="driver-profile-fleet" />
          <Info label="Org.nr." value={fleet?.org_number || '—'} s={s} border testID="driver-profile-org" />
        </View>

        <Text style={s.section}>Aktiv bil</Text>
        <View style={s.vehicleCard}>
          <View style={s.vehicleHead}>
            <View style={s.vehicleIcon}><Icon name="car" size={22} color={colors.online} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.vehicleTitle} testID="driver-profile-car">{activeVehicleLabel}</Text>
              <Text style={s.vehicleSub}>
                {activeVehicle
                  ? [vehicleMeta(activeVehicle.vehicle_type || 'ai-first').name, activeVehicle.color, activeVehicle.year].filter(Boolean).join(' · ')
                  : assignedVehicles.length
                    ? 'Velg hvilken av de tildelte bilene du kjører nå.'
                    : 'Løyvehaveren må tildele en bil før du kan gå online.'}
              </Text>
            </View>
          </View>

          <Pressable
            style={s.vehicleButton}
            onPress={() => setVehicleOpen(true)}
            testID="driver-profile-select-vehicle"
            accessibilityRole="button"
            accessibilityLabel="Velg tildelt bil"
          >
            <Text style={s.vehicleButtonText}>
              {activeVehicle ? 'Bytt bil' : 'Velg bil'}
            </Text>
            <Icon name="chevron-right" size={17} color={colors.text} />
          </Pressable>
        </View>

        <Text style={s.section}>Personlig</Text>
        <View style={s.infoCard}>
          <Info label="Navn" value={u.fullName || '—'} s={s} />
          <Info label="Telefon" value={u.phone || '—'} s={s} border />
          <Info label="E-post" value={u.email || '—'} s={s} border />
        </View>

        <View style={[s.infoCard, { marginTop: 20 }]}>
          <MenuRow icon="history" label="Mine turer" onPress={() => router.push('/driver-trips')} s={s} testID="profile-trips" />
          <MenuRow icon="settings" label="Innstillinger" onPress={() => router.push('/driver-settings')} s={s} border testID="profile-settings" />
        </View>

        <Pressable style={s.logout} onPress={logout} testID="driver-logout">
          <Icon name="log-out" size={18} color={colors.danger} />
          <Text style={s.logoutText}>Logg ut</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={vehicleOpen} transparent animationType="slide" onRequestClose={() => setVehicleOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => !vehicleBusy && setVehicleOpen(false)}>
          <Pressable style={[s.vehicleSheet, { paddingBottom: insets.bottom + 18 }]} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <View>
                <Text style={s.sheetOverline}>TILDELT AV LØYVEHAVER</Text>
                <Text style={s.sheetTitle}>Velg bilen du kjører</Text>
              </View>
              <Pressable onPress={() => !vehicleBusy && setVehicleOpen(false)} style={s.closeBtn}>
                <Icon name="x" size={18} color={colors.text} />
              </Pressable>
            </View>

            {!assignedVehicles.length ? (
              <View style={s.noVehicle}>
                <Icon name="car" size={28} color={colors.textMuted} />
                <Text style={s.noVehicleTitle}>Ingen biler er tildelt deg</Text>
                <Text style={s.noVehicleText}>Be løyvehaveren tildele bilen i KJAPP Partner. Du kan ikke gå online før en bil er valgt.</Text>
              </View>
            ) : (
              assignedVehicles.map((v: any) => {
                const selected = v.id === profile?.active_vehicle_id;
                return (
                  <Pressable
                    key={v.id}
                    style={[s.vehicleChoice, selected && s.vehicleChoiceSelected]}
                    onPress={() => !selected && selectVehicle(v.id)}
                    disabled={!!vehicleBusy || selected}
                    testID={`driver-vehicle-${v.id}`}
                  >
                    <View style={[s.vehicleChoiceIcon, selected && { backgroundColor: colors.onlineSoft }]}>
                      <Icon name="car" size={20} color={selected ? colors.online : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.vehicleChoiceTitle}>{v.car}</Text>
                      <Text style={s.vehicleChoiceSub}>
                        {v.plate} · {vehicleMeta(v.vehicle_type || 'ai-first').name}
                        {v.color ? ` · ${v.color}` : ''}
                      </Text>
                    </View>
                    {selected
                      ? <View style={s.selectedPill}><Icon name="check" size={13} color={colors.online} /><Text style={s.selectedText}>AKTIV</Text></View>
                      : vehicleBusy === v.id
                        ? <Text style={s.choosingText}>Velger…</Text>
                        : <Icon name="chevron-right" size={18} color={colors.textMuted} />}
                  </Pressable>
                );
              })
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Info({ label, value, valueColor, border, s, testID }: any) {
  return (
    <View style={[s.infoRow, border && s.infoBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor && { color: valueColor }]} testID={testID}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, border, s, testID }: { icon: IconName; label: string; onPress: () => void; border?: boolean; s: any; testID?: string }) {
  return (
    <Pressable style={[s.menuRow, border && s.infoBorder]} onPress={onPress} testID={testID}>
      <View style={s.menuIcon}><Icon name={icon} size={18} color={colors.accent} /></View>
      <Text style={s.menuLabel}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.text, fontFamily: font.display, fontSize: 28, marginBottom: 20 },
  card: { backgroundColor: c.driverCard, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  avatarWrap: { width: 86, height: 86, marginBottom: 14 },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 86, height: 86, borderRadius: 43, backgroundColor: c.onlineSoft },
  avatarText: { color: c.online, fontFamily: font.display, fontSize: 28 },
  photoEdit: { position: 'absolute', right: -2, bottom: 1, width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.driverCard },
  photoHint: { color: c.textMuted, fontSize: 10, marginTop: 6 },
  name: { color: c.text, fontFamily: font.display, fontSize: 22 },
  email: { color: c.textMuted, fontSize: 14, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { color: c.accent, fontSize: 12 },
  errorText: { color: c.danger, fontSize: 12, lineHeight: 17, marginTop: 12, paddingHorizontal: 4 },
  section: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 26, marginBottom: 8 },
  infoCard: { backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, paddingVertical: 16 },
  infoBorder: { borderTopWidth: 1, borderTopColor: c.line },
  infoLabel: { color: c.textMuted, fontSize: 14 },
  infoValue: { color: c.text, fontSize: 14, maxWidth: '65%', textAlign: 'right' },
  vehicleCard: { backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 16 },
  vehicleHead: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  vehicleIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center' },
  vehicleTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  vehicleSub: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  vehicleButton: { marginTop: 16, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  vehicleButtonText: { color: c.text, fontSize: 13, fontWeight: '700' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  menuIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontSize: 15, flex: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3,6,8,0.76)', justifyContent: 'flex-end' },
  vehicleSheet: { backgroundColor: c.elevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: c.line, paddingHorizontal: 20, paddingTop: 10, maxHeight: '76%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center', marginBottom: 18 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetOverline: { color: c.online, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  sheetTitle: { color: c.text, fontFamily: font.display, fontSize: 23, marginTop: 4 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line },
  vehicleChoice: { minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: c.line, paddingHorizontal: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.driverCard },
  vehicleChoiceSelected: { borderColor: 'rgba(57,229,140,0.45)', backgroundColor: c.onlineSoft },
  vehicleChoiceIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  vehicleChoiceTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  vehicleChoiceSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  selectedText: { color: c.online, fontSize: 9, fontWeight: '800' },
  choosingText: { color: c.textMuted, fontSize: 11 },
  noVehicle: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 22 },
  noVehicleTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  noVehicleText: { color: c.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
}));
