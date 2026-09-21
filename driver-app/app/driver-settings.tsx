import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { gdprApi, settingsApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

const NOTIF: { key: string; label: string; sub: string }[] = [
  { key: 'notif_requests', label: 'Turforespørsler', sub: 'Varsel når en ny tur er tilgjengelig' },
  { key: 'notif_messages', label: 'Meldinger', sub: 'Meldinger fra kunder' },
  { key: 'notif_payouts', label: 'Utbetalinger', sub: 'Beskjed når penger er utbetalt' },
];
const DRIVE: { key: string; label: string; sub: string }[] = [
  { key: 'req_sound', label: 'Lyd ved forespørsel', sub: 'Spill av lyd for nye turer' },
  { key: 'req_vibrate', label: 'Vibrasjon', sub: 'Vibrer ved nye turer' },
];

export default function DriverSettings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    settingsApi.get().then((r) => setSettings(r.settings || r || {})).catch(() => setSettings({}));
  }, []);

  const toggle = async (key: string, def = true) => {
    const cur = settings[key] === undefined ? def : settings[key];
    const next = { ...settings, [key]: !cur };
    setSettings(next);
    try { await settingsApi.update({ [key]: next[key] }); } catch {}
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'SLETT') return;
    setDeleting(true);
    try {
      await gdprApi.delete();
      await logout();
      router.replace('/');
    } catch { setDeleting(false); }
  };

  const version = Constants.expoConfig?.version || '1.0.0';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.driverBg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="driver-settings-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Innstillinger</Text>
      </View>

      {!settings ? (
        <View style={{ paddingTop: 60 }}><Loader /></View>
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={s.sectionTitle}>Varsler</Text>
          <View style={s.card}>
            {NOTIF.map((t, i) => (
              <ToggleRow key={t.key} t={t} on={settings[t.key] !== false} onToggle={() => toggle(t.key, true)} border={i > 0} s={s} />
            ))}
          </View>

          <Text style={s.sectionTitle}>Kjøring</Text>
          <View style={s.card}>
            {DRIVE.map((t, i) => (
              <ToggleRow key={t.key} t={t} on={settings[t.key] !== false} onToggle={() => toggle(t.key, true)} border={i > 0} s={s} />
            ))}
          </View>

          <Text style={s.sectionTitle}>Språk</Text>
          <View style={s.card}>
            <View style={s.linkRow}>
              <View style={s.linkIcon}><Icon name="globe" size={18} color={colors.accent} /></View>
              <Text style={s.linkLabel}>Språk</Text>
              <Text style={s.linkValue}>Norsk</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Personvern</Text>
          <View style={s.card}>
            <LinkRow icon="map-pin" label="Posisjonstilgang" onPress={() => Linking.openSettings()} s={s} testID="ds-location" />
            <LinkRow icon="file-text" label="Last ned mine data" onPress={() => Linking.openURL('mailto:support@kjappapp.com?subject=Innsyn%20i%20data')} border s={s} testID="ds-gdpr" />
          </View>

          <Text style={s.sectionTitle}>Hjelp</Text>
          <View style={s.card}>
            <LinkRow icon="help" label="Kontakt KJAPP" onPress={() => Linking.openURL('mailto:support@kjappapp.com')} s={s} testID="ds-support" />
            <LinkRow icon="shield" label="Nødhjelp (112)" onPress={() => Linking.openURL('tel:112')} border s={s} testID="ds-emergency" />
          </View>

          <Text style={s.sectionTitle}>Om appen</Text>
          <View style={s.card}>
            <View style={s.linkRow}><Text style={s.linkLabel}>Versjon</Text><Text style={s.linkValue}>{version}</Text></View>
            <View style={[s.linkRow, s.rowBorder]}><Text style={s.linkLabel}>Vilkår</Text><Text style={s.linkValue} onPress={() => Linking.openURL('https://kjappapp.no/vilkar')}>kjappapp.no/vilkar</Text></View>
          </View>

          <Pressable style={s.logout} onPress={logout} testID="ds-logout">
            <Icon name="log-out" size={18} color={colors.text} />
            <Text style={s.logoutText}>Logg ut</Text>
          </Pressable>

          <Pressable style={s.deleteBtn} onPress={() => setDeleteOpen(true)} testID="ds-delete-open">
            <Icon name="x" size={18} color={colors.danger} />
            <Text style={s.deleteText}>Slett konto</Text>
          </Pressable>

          <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
            <View style={s.modalBackdrop}>
              <View style={s.modalCard}>
                <View style={s.modalIcon}><Icon name="shield" size={24} color={colors.danger} /></View>
                <Text style={s.modalTitle}>Slette kontoen din?</Text>
                <Text style={s.modalBody}>Dette kan ikke angres. Skriv «SLETT» for å bekrefte.</Text>
                <TextInput
                  testID="ds-delete-input"
                  placeholder="SLETT"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={confirmText}
                  onChangeText={setConfirmText}
                  style={s.modalInput}
                />
                <Button label="Slett konto permanent" variant="danger" onPress={deleteAccount} loading={deleting} disabled={confirmText.trim().toUpperCase() !== 'SLETT'} testID="ds-delete-confirm" style={{ marginTop: 14 }} />
                <Pressable onPress={() => { setDeleteOpen(false); setConfirmText(''); }} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Avbryt</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </ScrollView>
  );
}

function ToggleRow({ t, on, onToggle, border, s }: any) {
  return (
    <View style={[s.row, border && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{t.label}</Text>
        <Text style={s.rowSub}>{t.sub}</Text>
      </View>
      <Switch value={on} onValueChange={onToggle} trackColor={{ false: colors.line, true: colors.online }} thumbColor={colors.text} testID={`ds-${t.key}`} />
    </View>
  );
}

function LinkRow({ icon, label, onPress, border, s, testID }: { icon: IconName; label: string; onPress: () => void; border?: boolean; s: any; testID?: string }) {
  return (
    <Pressable style={[s.linkRow, border && s.rowBorder]} onPress={onPress} testID={testID}>
      <View style={s.linkIcon}><Icon name={icon} size={18} color={colors.accent} /></View>
      <Text style={s.linkLabel}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: c.driverCard, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.line },
  rowLabel: { color: c.text, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  linkIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { color: c.text, fontSize: 15, flex: 1 },
  linkValue: { color: c.textMuted, fontSize: 14 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line },
  logoutText: { color: c.text, fontSize: 15, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, paddingVertical: 16, borderRadius: 16, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  deleteText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,10,0.75)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
}));
