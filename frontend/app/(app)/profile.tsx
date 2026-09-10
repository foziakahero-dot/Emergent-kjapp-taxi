import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { useAuth } from '@/src/context/AuthContext';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();

  const initials = (user?.fullName || user?.email || 'K')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const rows: { icon: IconName; label: string; onPress: () => void; testID: string }[] = [
    { icon: 'card', label: 'Betalingsmåter', onPress: () => router.push('/payment-methods'), testID: 'profile-payments' },
    { icon: 'settings', label: 'Innstillinger', onPress: () => router.push('/settings'), testID: 'profile-settings' },
    { icon: 'help', label: 'Hjelp og support', onPress: () => router.push('/settings'), testID: 'profile-help' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={s.title}>Profil</Text>

      <View style={s.card} testID="profile-card">
        <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        <Text style={s.name}>{user?.fullName || 'KJAPP-bruker'}</Text>
        <Text style={s.email}>{user?.email}</Text>
        {user?.phone ? <Text style={s.email}>{user.phone}</Text> : null}
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

      <Pressable style={s.logout} onPress={logout} testID="profile-logout">
        <Icon name="log-out" size={18} color={colors.danger} />
        <Text style={s.logoutText}>Logg ut</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  title: { fontFamily: font.display, fontSize: 28, color: c.text, marginBottom: 20 },
  card: { backgroundColor: c.card, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { color: c.accent, fontFamily: font.display, fontSize: 28 },
  name: { color: c.text, fontFamily: font.display, fontSize: 22 },
  email: { color: c.textMuted, fontSize: 14, marginTop: 4 },
  menu: { marginTop: 20, backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: c.text, fontSize: 15, flex: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16 },
  logoutText: { color: c.danger, fontSize: 15, fontWeight: '600' },
}));
