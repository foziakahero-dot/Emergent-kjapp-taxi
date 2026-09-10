import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';

export default function DriverProfile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { user, logout } = useAuth();

  const initials = (user?.fullName || 'S').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Text style={s.title}>Profil</Text>

      <View style={s.card}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <Text style={s.name}>{user?.fullName || 'Sjåfør'}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.badge}>
          <Icon name="car" size={14} color={colors.online} />
          <Text style={s.badgeText}>Godkjent sjåfør</Text>
        </View>
      </View>

      <View style={s.info}>
        <View style={s.infoRow}><Text style={s.infoLabel}>Telefon</Text><Text style={s.infoValue}>{user?.phone || '—'}</Text></View>
        <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]}>
          <Text style={s.infoLabel}>Rolle</Text><Text style={s.infoValue}>Sjåfør</Text>
        </View>
      </View>

      <Pressable style={s.logout} onPress={logout} testID="driver-logout">
        <Icon name="log-out" size={18} color={colors.danger} />
        <Text style={s.logoutText}>Logg ut</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.text, fontFamily: font.display, fontSize: 28, marginBottom: 20 },
  card: { backgroundColor: c.driverCard, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.onlineSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { color: c.online, fontFamily: font.display, fontSize: 28 },
  name: { color: c.text, fontFamily: font.display, fontSize: 22 },
  email: { color: c.textMuted, fontSize: 14, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.onlineSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 14 },
  badgeText: { color: c.online, fontSize: 12 },
  info: { marginTop: 20, backgroundColor: c.driverCard, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  infoLabel: { color: c.textMuted, fontSize: 14 },
  infoValue: { color: c.text, fontSize: 14 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 15, fontWeight: '600' },
}));
