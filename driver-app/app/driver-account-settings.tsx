import { Text, TextInput } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon, IconName } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { gdprApi, settingsApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import { storage } from '@/src/utils/storage';
import { isNavigationApp, navigationStorageKey, NavigationApp } from '@/src/lib/navigationPreference';

const NOTIF: { key: string; label: string; sub: string }[] = [
  { key: 'notif_requests', label: 'Turforespørsler', sub: 'Varsel når en ny tur er tilgjengelig' },
];
const DRIVE: { key: string; label: string; sub: string }[] = [
  { key: 'req_sound', label: 'Lyd ved forespørsel', sub: 'Spill av lyd for nye turer' },
  { key: 'req_vibrate', label: 'Vibrasjon', sub: 'Vibrer ved nye turer' },
];

export default function DriverAccountSettings() {
  useColorTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState('');
  const [navigationSaving, setNavigationSaving] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const navigationBusy = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    settingsApi.get().then(async (r) => {
      const data = r.settings || r || {};
      const key = navigationStorageKey(user.id);
      const cached = await storage.getItem(key).catch(() => null);
      const choice = isNavigationApp(data.navigation_app) ? data.navigation_app :
        isNavigationApp(cached) ? cached : 'google';
      if (!active) return;
      setSettings({ ...data, navigation_app: choice });
      await storage.setItem(key, choice);
      for (const key of ['notif_requests', 'req_sound', 'req_vibrate']) {
        await storage.setItem(`driver_${key}`, String(data[key] !== false));
      }
    }).catch(async () => {
      const cached = await storage.getItem(navigationStorageKey(user.id)).catch(() => null);
      if (active) setSettings({ navigation_app: isNavigationApp(cached) ? cached : 'google' });
    });
    return () => { active = false; };
  }, [user?.id]);

  const selectNavigation = async (choice: NavigationApp) => {
    if (!user?.id || navigationBusy.current) return;
    navigationBusy.current = true;
    setNavigationSaving(true);
    setNavigationError('');
    try {
      const response = await settingsApi.update({ navigation_app: choice });
      if ((response?.settings || response)?.navigation_app !== choice) {
        throw new Error('Server did not confirm navigation preference');
      }
      setSettings((previous: any) => ({ ...previous, navigation_app: choice }));
      // A cache failure must not undo a preference already saved by the server.
      await storage.setItem(navigationStorageKey(user.id), choice).catch(() => {});
    } catch {
      setNavigationError('Kunne ikke lagre navigasjonsvalget. Prøv igjen.');
    } finally {
      navigationBusy.current = false;
      setNavigationSaving(false);
    }
  };

  const toggle = async (key: string, def = true) => {
    const cur = settings[key] === undefined ? def : settings[key];
    const next = { ...settings, [key]: !cur };
    setSettings(next);
    try {
      await settingsApi.update({ [key]: next[key] });
      if (['notif_requests', 'req_sound', 'req_vibrate'].includes(key)) {
        await storage.setItem(`driver_${key}`, String(next[key]));
      }
    } catch {
      setSettings(settings);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setExportInfo('');
    try {
      const data = await gdprApi.export();
      const trips = (data?.trips || []).length;
      const payments = (data?.payments || []).length;
      setExportInfo(`Dataene dine er hentet: ${trips} turer, ${payments} betalinger. Kontakt support@snarapp.no hvis du trenger kopi på e-post.`);
    } catch {
      setExportInfo('Kunne ikke hente data akkurat nå. Prøv igjen senere.');
    } finally {
      setExporting(false);
    }
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
  const buildNumber =
    (Constants.expoConfig?.ios as any)?.buildNumber ||
    (Constants.expoConfig?.android as any)?.versionCode ||
    null;

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
          <View style={s.card}><LinkRow icon="bell" label="Turvarsler og kjørevalg" onPress={() => router.push('/driver-account')} s={s} /></View>

          <View style={s.card}><LinkRow icon="settings" label="Lyd, vibrasjon og visning" onPress={() => router.push('/driver-settings')} s={s} /></View>

          <Text style={s.sectionTitle}>Min konto</Text>
          <View style={s.card}><LinkRow icon="user" label="Konto og profil" onPress={() => router.push('/driver-account')} s={s} testID="ds-account" /></View>

          <Text style={s.sectionTitle}>Mine biler</Text>
          <View style={s.card}>
            <LinkRow icon="car" label={user?.car && user?.plate ? `${user.car} · ${user.plate}` : 'Velg bil fra flåten'}
              onPress={() => router.push('/driver-vehicles')} s={s} testID="ds-vehicles" />
            <LinkRow icon="shield" label="Identitetskontroll" onPress={() => router.push('/driver-identity')}
              border s={s} testID="ds-identity" />
          </View>

          <Text style={s.sectionTitle}>Navigasjon</Text>
          <View style={s.card}>
            {([
              ['google', 'Google Maps'],
              ['waze', 'Waze'],
              ...(Platform.OS === 'ios' ? [['apple', 'Apple Kart']] : []),
            ] as string[][]).map(([key, label], i) => (
              <Pressable key={key} testID={`driver-navigation-${key}`} disabled={navigationSaving}
                accessibilityRole="radio" accessibilityState={{ selected: (settings.navigation_app || 'google') === key }}
                style={[s.row, i > 0 && s.rowBorder]}
                onPress={() => { if (isNavigationApp(key)) void selectNavigation(key); }}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={[s.rowSub, { marginLeft: 'auto' }]}>{(settings.navigation_app || 'google') === key ? 'Valgt' : ''}</Text>
              </Pressable>
            ))}
          </View>

          {navigationError ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginTop: 8 }}>{navigationError}</Text> : null}

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
            <LinkRow icon="file-text" label={exporting ? 'Henter data…' : 'Last ned mine data'} onPress={() => void exportData()} border s={s} testID="ds-gdpr" />
            <LinkRow icon="shield" label="Personvern" onPress={() => Linking.openURL('https://snarapp.no/personvern')} border s={s} testID="ds-privacy" />
          </View>
          {exportInfo ? <Text style={s.exportInfo} testID="ds-gdpr-info">{exportInfo}</Text> : null}

          <Text style={s.sectionTitle}>Hjelp</Text>
          <View style={s.card}>
            <LinkRow icon="help" label="Kontakt SNAR" onPress={() => Linking.openURL('https://snarapp.no/help')} s={s} testID="ds-support" />
            <LinkRow icon="shield" label="Nødhjelp (112)" onPress={() => Linking.openURL('tel:112')} border s={s} testID="ds-emergency" />
          </View>

          <Text style={s.sectionTitle}>Om appen</Text>
          <View style={s.card}>
            <View style={s.linkRow}><Text style={s.linkLabel}>Versjon</Text><Text style={s.linkValue}>{version}{buildNumber ? ` (${buildNumber})` : ''}</Text></View>
            <View style={s.linkRow}><Text style={s.linkLabel}>Kilde</Text><Text style={s.linkValue}>Byggekilde: {Constants.expoConfig?.extra?.EXPO_PUBLIC_SOURCE_SHA?.slice(0, 8) ?? 'ukjent'}</Text></View>
            <View style={[s.linkRow, s.rowBorder]}><Text style={s.linkLabel}>Vilkår</Text><Text style={s.linkValue} onPress={() => Linking.openURL('https://snarapp.no/vilkar')}>snarapp.no/vilkar</Text></View>
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
  useColorTheme();
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
  useColorTheme();
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
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: c.driverCard, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.line },
  rowLabel: { color: c.text, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  exportInfo: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8, paddingHorizontal: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  linkIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { color: c.text, fontSize: 15, flex: 1 },
  linkValue: { color: c.textMuted, fontSize: 14 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16, borderRadius: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  logoutText: { color: c.text, fontSize: 15, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, paddingVertical: 16, borderRadius: 16, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.line },
  deleteText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
}));
