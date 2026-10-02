import { FigmaGradient } from '@/src/components/FigmaGradient';
import { Text } from '@/src/components/Typography';
import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, authenticatedFileSource, driverApi } from '@/src/lib/api';
import { vehicleMeta } from '@/src/lib/format';

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const { data: ratings } = useQuery({ queryKey: ['driver-ratings'], queryFn: driverApi.ratings });
  const u = { ...(user || {}), ...(me || {}) } as any;

  const initials = (u.fullName || 'S').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  const vName = vehicleMeta(u.vehicle_type || 'ai-first').name;
  const { data: profilePhotoSource } = useQuery({
    queryKey: ['driver-profile-photo-source', u.profile_photo_path],
    queryFn: () => authenticatedFileSource(u.profile_photo_path),
    enabled: !!u.profile_photo_path,
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 112, paddingHorizontal: 28 }}>
      <Text style={s.title}>Min profil</Text>

      <View style={s.card}>
        <Pressable style={s.avatarWrap} onPress={() => router.push('/driver-profile-photo')} testID="driver-profile-photo-open">
          <View style={s.avatar}>
            {profilePhotoSource ? <Image source={profilePhotoSource} style={s.avatarImage} /> : <Text style={s.avatarText}>{initials}</Text>}
          </View>
          <View style={s.photoBadge}><Icon name="user" size={12} color={colors.accentOn} /></View>
        </Pressable>
        <View style={s.identityText}>
          <Text style={s.name}>{u.fullName || 'Sjåfør'}</Text>
          <Text style={s.email}>{u.phone || u.email}</Text>
        </View>
        <View style={s.badgeRow}>
          <View style={s.badge}>
            <Icon name="star" size={13} color={colors.accent} fill={colors.accent} />
            <Text style={s.badgeText}>{ratings?.count ? `${ratings.average} · ${ratings.count} turer` : 'Ingen vurderinger'}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: colors.onlineSoft }]}>
            <Icon name="check" size={13} color={colors.online} />
            <Text style={[s.badgeText, { color: colors.online }]}>Godkjent</Text>
          </View>
        </View>
      </View>

      <Text style={s.section}>Løyvehaver</Text>
      <View style={s.infoCard} testID="driver-fleet-card">
        <Info label="Firma" value={u.fleet_name || 'Ikke tilknyttet'} s={s} />
        <Info label="Org.nr." value={u.fleet_org_number || '—'} s={s} border />
      </View>

      <Text style={s.section}>Aktiv bil</Text>
      <View style={s.infoCard} testID="driver-assigned-vehicle-card">
        <Info label="Bil" value={u.car || 'Ingen bil tildelt'} s={s} />
        <Info label="Skilt" value={u.plate || '—'} s={s} border />
        <Info label="Klasse" value={u.vehicle_id ? vName : '—'} s={s} border />
        <Info label="Tildeling" value={u.vehicle_id ? 'Tildelt av løyvehaver' : 'Mangler tildeling'} valueColor={u.vehicle_id ? colors.online : colors.danger} s={s} border />
      </View>
      <Text style={s.vehicleHint}>Løyvehaveren bestemmer hvilke biler du kan bruke. Du velger aktiv bil i «Mine biler» før du går online.</Text>

      <Text style={s.section}>Personlig</Text>
      <View style={s.infoCard}>
        <Info label="Navn" value={u.fullName || '—'} s={s} />
        <Info label="Telefon" value={u.phone || '—'} s={s} border />
        <Info label="E-post" value={u.email || '—'} s={s} border />
      </View>

      <View style={[s.infoCard, { marginTop: 20 }]}>
        <MenuRow icon="car" label="Mine biler" onPress={() => router.push('/driver-vehicles')} s={s} testID="profile-vehicles" />
        <MenuRow icon="user" label="Profilbilde" onPress={() => router.push('/driver-profile-photo')} s={s} border testID="profile-photo" />
        <MenuRow icon="shield" label="Identitetskontroll" onPress={() => router.push('/driver-identity')} s={s} border testID="profile-identity" />
        <MenuRow icon="history" label="Mine turer" onPress={() => router.push('/driver-trips')} s={s} border testID="profile-trips" />
        <MenuRow icon="settings" label="Innstillinger" onPress={() => router.push('/driver-settings')} s={s} border testID="profile-settings" />
      </View>

      <Pressable style={s.logout} onPress={logout} testID="driver-logout">
        <Icon name="log-out" size={18} color={colors.danger} />
        <Text style={s.logoutText}>Logg ut</Text>
      </Pressable>
    </ScrollView>
  );
}

function Info({ label, value, valueColor, border, s }: any) {
  return (
    <View style={[s.infoRow, border && s.infoBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
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
  title: { color: c.text, fontFamily: font.semibold, fontSize: 24, marginBottom: 20, letterSpacing: -0.5 },
  card: { minHeight: 104, flexDirection: 'row', gap: 14, backgroundColor: c.driverCard, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 18, alignItems: 'center' },
  avatarWrap: { width: 66, height: 66, position: 'relative' },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 62, height: 62, borderRadius: 31 },
  photoBadge: { position: 'absolute', right: 0, bottom: 2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.online, borderWidth: 2, borderColor: c.driverCard },
  avatarText: { color: c.accentOn, fontFamily: font.semibold, fontSize: 22 },
  identityText: { flex: 1 },
  name: { color: c.text, fontFamily: font.semibold, fontSize: 18 },
  email: { color: c.textSecondary, fontSize: 11.5, marginTop: 4 },
  badgeRow: { position: 'absolute', left: 96, bottom: 13, flexDirection: 'row', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: c.accent, fontSize: 9.5 },
  section: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 26, marginBottom: 8 },
  vehicleHint: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8, paddingHorizontal: 4 },
  infoCard: { backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  infoBorder: { borderTopWidth: 1, borderTopColor: c.line },
  infoLabel: { color: c.textMuted, fontSize: 14 },
  infoValue: { color: c.text, fontSize: 14 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  menuIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontSize: 15, flex: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 15, fontWeight: '600' },
}));

