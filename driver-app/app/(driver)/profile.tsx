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
  const vName = vehicleMeta(u.vehicle_type || 'ai-first').name;

  const handleLogout = async () => {
    await logout();
    router.replace('/driver-login');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.driverBg }}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 110, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.headerRow}>
        <View>
          <Text style={s.kicker}>KJAPP DRIVER</Text>
          <Text style={s.title}>Profil</Text>
        </View>
        <View style={s.verifiedTop}>
          <Icon name="check" size={14} color={colors.online} />
          <Text style={s.verifiedTopText}>GODKJENT</Text>
        </View>
      </View>

      <View style={s.heroCard} testID="driver-profile-card">
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <Text style={s.name}>{u.fullName || 'Sjåfør'}</Text>
        <Text style={s.email}>{u.email}</Text>

        <View style={s.metricsRow}>
          <View style={s.metric}>
            <Icon name="star" size={15} color={colors.accent} fill={colors.accent} />
            <Text style={s.metricValue}>{ratings?.count ? String(ratings.average) : '—'}</Text>
            <Text style={s.metricLabel}>rating</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metric}>
            <Icon name="car" size={15} color={colors.online} />
            <Text style={s.metricValue}>{ratings?.count ?? 0}</Text>
            <Text style={s.metricLabel}>turer</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metric}>
            <View style={s.liveDot} />
            <Text style={[s.metricValue, { color: colors.online }]}>Aktiv</Text>
            <Text style={s.metricLabel}>status</Text>
          </View>
        </View>
      </View>

      <Text style={s.section}>KJØRETØY</Text>
      <View style={s.vehicleCard}>
        <View style={s.vehicleIcon}>
          <Icon name="car" size={25} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.vehicleName}>{u.car || 'Kjøretøy ikke registrert'}</Text>
          <Text style={s.vehicleMeta}>{u.plate || '—'} · {vName}</Text>
        </View>
        <View style={s.activeBadge}><Text style={s.activeBadgeText}>AKTIV</Text></View>
      </View>

      <Text style={s.section}>KONTO</Text>
      <View style={s.infoCard}>
        <Info label="Telefon" value={u.phone || '—'} s={s} />
        <Info label="E-post" value={u.email || '—'} s={s} border />
      </View>

      <View style={[s.infoCard, { marginTop: 14 }]}>
        <MenuRow icon="history" label="Mine turer" sub="Historikk og gjennomførte turer" onPress={() => router.push('/driver-trips')} s={s} testID="profile-trips" />
        <MenuRow icon="settings" label="Innstillinger" sub="Varsler, personvern og preferanser" onPress={() => router.push('/driver-settings')} s={s} border testID="profile-settings" />
      </View>

      <Pressable style={s.logout} onPress={handleLogout} testID="driver-logout">
        <Icon name="log-out" size={18} color={colors.danger} />
        <Text style={s.logoutText}>Logg ut</Text>
      </Pressable>
    </ScrollView>
  );
}

function Info({ label, value, border, s }: any) {
  return (
    <View style={[s.infoRow, border && s.infoBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon, label, sub, onPress, border, s, testID }: { icon: IconName; label: string; sub: string; onPress: () => void; border?: boolean; s: any; testID?: string }) {
  return (
    <Pressable style={[s.menuRow, border && s.infoBorder]} onPress={onPress} testID={testID}>
      <View style={s.menuIcon}><Icon name={icon} size={18} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.menuLabel}>{label}</Text>
        <Text style={s.menuSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  kicker: { color: c.online, fontSize: 9, letterSpacing: 2.5, fontWeight: '800' },
  title: { color: c.text, fontFamily: font.display, fontSize: 31, marginTop: 2 },
  verifiedTop: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(47,224,140,0.24)' },
  verifiedTopText: { color: c.online, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  heroCard: { backgroundColor: c.driverCard, borderRadius: 28, borderWidth: 1, borderColor: c.lineStrong, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(47,224,140,0.25)' },
  avatarText: { color: c.online, fontFamily: font.display, fontSize: 32 },
  name: { color: c.text, fontFamily: font.display, fontSize: 24, marginTop: 15 },
  email: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  metricsRow: { width: '100%', flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: c.line },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricDivider: { width: 1, height: 38, backgroundColor: c.line },
  metricValue: { color: c.text, fontFamily: font.mono, fontSize: 15 },
  metricLabel: { color: c.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.online, shadowColor: c.online, shadowOpacity: 0.7, shadowRadius: 8 },
  section: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 26, marginBottom: 9, marginLeft: 4 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.driverCard, borderRadius: 21, borderWidth: 1, borderColor: c.line, padding: 16 },
  vehicleIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  vehicleName: { color: c.text, fontSize: 15, fontWeight: '700' },
  vehicleMeta: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  activeBadge: { backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  activeBadgeText: { color: c.online, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  infoCard: { backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, paddingVertical: 15 },
  infoBorder: { borderTopWidth: 1, borderTopColor: c.line },
  infoLabel: { color: c.textMuted, fontSize: 12 },
  infoValue: { color: c.text, fontSize: 12, flex: 1, textAlign: 'right' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  menuSub: { color: c.textMuted, fontSize: 10, marginTop: 3 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 14, fontWeight: '600' },
}));
