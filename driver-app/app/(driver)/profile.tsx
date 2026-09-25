import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';
import { authApi, driverApi } from '@/src/lib/api';
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
  const vName = u.vehicle_type ? vehicleMeta(u.vehicle_type).name : 'Ikke registrert';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Text style={s.title}>Profil</Text>

      <View style={s.card}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <Text style={s.name}>{u.fullName || 'Sjåfør'}</Text>
        <Text style={s.email}>{u.email}</Text>
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

      <Text style={s.section}>Kjøretøy</Text>
      <View style={s.infoCard}>
        <Info label="Bil" value={u.car || 'Ikke registrert'} s={s} testID="driver-profile-car" />
        <Info label="Skilt" value={u.plate || 'Ikke registrert'} s={s} border testID="driver-profile-plate" />
        <Info label="Klasse" value={vName} s={s} border testID="driver-profile-class" />
        <Info label="Status" value="Aktiv" valueColor={colors.online} s={s} border />
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
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { color: c.online, fontFamily: font.display, fontSize: 28 },
  name: { color: c.text, fontFamily: font.display, fontSize: 22 },
  email: { color: c.textMuted, fontSize: 14, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { color: c.accent, fontSize: 12 },
  section: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 26, marginBottom: 8 },
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
