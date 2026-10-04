import { Text, TextInput } from '@/src/components/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { gdprApi, settingsApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

const TOGGLES: { key: string; label: string; sub: string }[] = [
  { key: 'notifications', label: 'Varsler', sub: 'Varsler knyttet til SNAR-turen din' },
  { key: 'trip_updates', label: 'Turoppdateringer', sub: 'Status når sjåføren er på vei og turen endrer fase' },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [settingsError, setSettingsError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const deleteLock = useRef(false);
  const [deleteError, setDeleteError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState<string>('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber =
    (Constants.expoConfig?.ios as any)?.buildNumber ||
    (Constants.expoConfig?.android as any)?.versionCode ||
    null;

  const exportLock = useRef(false);
  const exportData = async () => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    setExportInfo('');
    try {
      const d = await gdprApi.export();
      const fullMessage = JSON.stringify(d, null, 2);
      const androidSafeLimit = 700_000;
      let message = fullMessage;
      let compacted = false;

      if (fullMessage.length > androidSafeLimit) {
        compacted = true;
        message = JSON.stringify(d, (key, value) => {
          if (key === 'data_base64') return '[utelatt fra deling: binær bildedata finnes i original eksport]';
          return value;
        }, 2);
      }

      if (message.length > androidSafeLimit) {
        message = JSON.stringify(d, (key, value) => {
          if (key === 'data_base64') return '[utelatt fra deling: binær bildedata finnes i original eksport]';
          if (['route_geometry', 'route_geojson', 'geometry', 'polyline'].includes(key)) {
            return '[utelatt fra deling: stor rutegeometri finnes i original eksport]';
          }
          return value;
        }, 2);
      }

      if (message.length > androidSafeLimit) {
        message = JSON.stringify({
          export_notice: 'SNAR hentet hele eksporten, men datasettet er for stort for Android-delingsarket. Kontakt support for sikker filutlevering av hele eksporten.',
          generated_at: new Date().toISOString(),
          summary: {
            trips: Array.isArray((d as any)?.trips) ? (d as any).trips.length : undefined,
            messages: Array.isArray((d as any)?.messages) ? (d as any).messages.length : undefined,
            payments: Array.isArray((d as any)?.payments) ? (d as any).payments.length : undefined,
          },
        }, null, 2);
      }

      await Share.share({ title: 'Mine SNAR-data', message });
      setExportInfo(compacted
        ? 'Dataeksporten er hentet. Store bilde- eller rutedata ble utelatt fra delingsarket for å unngå Android-feil.'
        : 'Dataeksporten er hentet.');
    } catch {
      setExportInfo('Kunne ikke hente data akkurat nå. Prøv igjen senere.');
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteLock.current || confirmText.trim().toUpperCase() !== 'SLETT') return;
    deleteLock.current = true; setDeleteError('');
    setDeleting(true);
    try {
      await gdprApi.delete();
      await logout();
      router.replace('/');
    } catch {
      setDeleteError('Kunne ikke slette kontoen. Prøv igjen når forbindelsen er tilbake.');
      setDeleting(false);
    } finally { deleteLock.current = false; }
  };

  const loadSettings = useCallback(async () => {
    setSettingsError('');
    try { const response = await settingsApi.get(); setSettings(response.settings || response); }
    catch { setSettingsError('Kunne ikke hente innstillingene. Sjekk forbindelsen og prøv igjen.'); }
  }, []);
  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const toggle = async (key: string) => {
    if (savingLock.current || !settings) return;
    savingLock.current = true; setSaving(true); setSettingsError('');
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try { await settingsApi.update({ [key]: next[key] }); }
    catch { setSettings(previous); setSettingsError('Endringen ble ikke lagret. Prøv igjen når forbindelsen er tilbake.'); }
    finally { savingLock.current = false; setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="settings-back" accessibilityRole="button" accessibilityLabel="Tilbake">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Innstillinger</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {settingsError ? <View><Text testID="settings-network-error" accessibilityRole="alert" style={{ color: colors.danger }}>{settingsError}</Text><Button testID="settings-retry" label="Prøv igjen" onPress={() => void loadSettings()} /></View> : null}
        {!settings ? (
          <View style={{ paddingTop: 60 }}>{!settingsError ? <Loader /> : null}</View>
        ) : (
          <>
            <Text style={s.sectionTitle}>Turvarsler</Text>
            <View style={s.card}>
              {TOGGLES.map((t, i) => (
                <View key={t.key} style={[s.row, i < TOGGLES.length - 1 && s.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{t.label}</Text>
                    <Text style={s.rowSub}>{t.sub}</Text>
                  </View>
                  <Switch
                    testID={`setting-${t.key}`}
                    value={!!settings[t.key]}
                    disabled={saving}
                    onValueChange={() => toggle(t.key)}
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.text}
                  />
                </View>
              ))}
            </View>

            <View style={[s.card, { marginTop: 16 }]}>
              <View style={s.infoRow}><Text style={s.rowLabel}>Versjon</Text><Text style={s.rowValue}>{version}{buildNumber ? ` (${buildNumber})` : ''}</Text></View>
              <Pressable testID="customer-app-settings-110" style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]} onPress={() => Linking.openURL('https://kjappapp.no/help')}>
                <Text style={s.rowLabel}>Support</Text><Text style={s.rowValue}>support@kjappapp.no</Text>
              </Pressable>
              <Pressable testID="customer-app-settings-113" style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]} onPress={() => Linking.openURL('https://kjappapp.no/personvern')}>
                <Text style={s.rowLabel}>Personvern</Text><Text style={s.rowValue}>Åpne</Text>
              </Pressable>
              <Pressable testID="customer-app-settings-116" style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]} onPress={() => Linking.openURL('https://kjappapp.no/vilkar')}>
                <Text style={s.rowLabel}>Vilkår</Text><Text style={s.rowValue}>Åpne</Text>
              </Pressable>
            </View>

            <Text style={s.sectionTitle}>Personvern og data</Text>
            <View style={s.card}>
              <Pressable style={s.gdprRow} onPress={exportData} disabled={exporting} testID="gdpr-export">
                <View style={s.gdprIcon}><Icon name="file-text" size={18} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>Last ned mine data</Text>
                  <Text style={s.rowSub}>Få innsyn i dataene vi lagrer om deg (GDPR)</Text>
                </View>
                {exporting ? <Loader /> : <Icon name="chevron-right" size={18} color={colors.textMuted} />}
              </Pressable>
              {exportInfo ? <Text style={s.exportInfo} testID="gdpr-export-info">{exportInfo}</Text> : null}
            </View>

            <Pressable style={s.deleteBtn} onPress={() => setDeleteOpen(true)} testID="gdpr-delete-open">
              <Icon name="x" size={18} color={colors.danger} />
              <Text style={s.deleteText}>Slett konto</Text>
            </Pressable>
            <Text style={s.deleteHint}>Sletting fjerner kontoen din permanent. Turer anonymiseres for regnskap.</Text>

            <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
              <View style={s.modalBackdrop}>
                <View style={s.modalCard}>
                  <View style={s.modalIcon}><Icon name="shield" size={24} color={colors.danger} /></View>
                  <Text style={s.modalTitle}>Slette kontoen din?</Text>
                  <Text style={s.modalBody}>Dette kan ikke angres. Skriv «SLETT» for å bekrefte.</Text>
                  <TextInput
                    testID="gdpr-delete-confirm-input"
                    placeholder="SLETT"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    value={confirmText}
                    onChangeText={setConfirmText}
                    style={s.modalInput}
                  />
                  {deleteError ? <Text testID="gdpr-delete-error" accessibilityRole="alert" style={{ color: colors.danger }}>{deleteError}</Text> : null}
                  <Button
                    label="Slett konto permanent"
                    variant="danger"
                    onPress={deleteAccount}
                    loading={deleting}
                    disabled={confirmText.trim().toUpperCase() !== 'SLETT'}
                    testID="gdpr-delete-confirm"
                    style={{ marginTop: 14 }}
                  />
                  <Pressable onPress={() => { setDeleteOpen(false); setConfirmText(''); }} style={{ marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} testID="gdpr-delete-cancel">
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>Avbryt</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: font.display, fontSize: 26, color: c.text },
  sectionTitle: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 13, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowLabel: { color: c.text, fontFamily: font.medium, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  rowValue: { color: c.textMuted, fontSize: 14 },
  gdprRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  gdprIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  exportInfo: { color: c.textMuted, fontSize: 13, lineHeight: 19, paddingBottom: 14 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, minHeight: 52, borderRadius: 14, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.line },
  deleteText: { color: c.danger, fontFamily: font.semibold, fontSize: 15 },
  deleteHint: { color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontFamily: font.body, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
}));
