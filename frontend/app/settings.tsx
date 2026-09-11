import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { gdprApi, settingsApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

const TOGGLES: { key: string; label: string; sub: string }[] = [
  { key: 'notifications', label: 'Varsler', sub: 'Push-varsler om turen din' },
  { key: 'trip_updates', label: 'Turoppdateringer', sub: 'Sanntidsstatus når sjåfør er på vei' },
  { key: 'price_alerts', label: 'Prisvarsler', sub: 'Beskjed ved lav pris i ditt område' },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const router = useRouter();
  const { logout } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState<string>('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    setExportInfo('');
    try {
      const d = await gdprApi.export();
      const trips = (d.trips || []).length;
      const payments = (d.payments || []).length;
      setExportInfo(`Dataene dine er hentet: ${trips} turer, ${payments} betalinger. Kontakt support@kjapp.no for en full kopi på e-post.`);
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
    } catch {
      setDeleting(false);
    }
  };

  useEffect(() => {
    settingsApi.get().then((r) => setSettings(r.settings || r)).catch(() => setSettings({}));
  }, []);

  const toggle = async (key: string) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try { await settingsApi.update({ [key]: next[key] }); } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="settings-back">
          <Icon name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Innstillinger</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {!settings ? (
          <View style={{ paddingTop: 60 }}><Loader /></View>
        ) : (
          <>
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
                    onValueChange={() => toggle(t.key)}
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.text}
                  />
                </View>
              ))}
            </View>

            <View style={[s.card, { marginTop: 16 }]}>
              <View style={s.infoRow}><Text style={s.rowLabel}>Versjon</Text><Text style={s.rowValue}>1.0.0</Text></View>
              <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={s.rowLabel}>Support</Text><Text style={s.rowValue}>support@kjapp.no</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Personvern og data</Text>
            <View style={s.card}>
              <Pressable style={s.gdprRow} onPress={exportData} disabled={exporting} testID="gdpr-export">
                <View style={s.gdprIcon}><Icon name="wallet" size={18} color={colors.accent} /></View>
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
                  <Button
                    label="Slett konto permanent"
                    variant="danger"
                    onPress={deleteAccount}
                    loading={deleting}
                    disabled={confirmText.trim().toUpperCase() !== 'SLETT'}
                    testID="gdpr-delete-confirm"
                    style={{ marginTop: 14 }}
                  />
                  <Pressable onPress={() => { setDeleteOpen(false); setConfirmText(''); }} style={{ marginTop: 12, alignItems: 'center' }} testID="gdpr-delete-cancel">
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
  card: { backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowLabel: { color: c.text, fontSize: 15 },
  rowSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  rowValue: { color: c.textMuted, fontSize: 14 },
  sectionTitle: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 28, marginBottom: 10 },
  gdprRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  gdprIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cardSubtle, alignItems: 'center', justifyContent: 'center' },
  exportInfo: { color: c.textMuted, fontSize: 13, lineHeight: 19, paddingBottom: 14 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16, borderRadius: 16, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' },
  deleteText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  deleteHint: { color: c.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,10,0.75)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
}));
