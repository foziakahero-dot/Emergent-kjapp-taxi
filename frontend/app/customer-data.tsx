import { Text, TextInput } from '@/src/components/Typography';
import React, { useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors, font, makeStyles, useColorTheme } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { gdprApi } from '@/src/lib/api';
import { V10Action, V10Group, V10Header, V10Row, V10Screen, V10Section, v10 } from '@/src/components/V10UI';
import { useTranslation } from '@/src/lib/customerLanguage';
import { useAuth } from '@/src/context/AuthContext';

export default function CustomerData() {
  useColorTheme();
  const { t } = useTranslation();
  const s = useStyles();
  const router = useRouter();
  const { logout } = useAuth();
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
      const dataJson = JSON.stringify(d, null, 2);

      // expo-sharing cannot share local file URIs on web. Keep the GDPR export
      // file-based on native so large exports never go through an Android Intent message.
      if (Platform.OS === 'web') {
        setExportInfo(t("Filbasert dataeksport er tilgjengelig i SNAR-mobilappen."));
        return;
      }

      const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setExportInfo(t("Deling er ikke tilgjengelig på denne enheten. Prøv igjen på Android eller iPhone."));
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `SNAR-persondata-${timestamp}.json`);
      file.create({ overwrite: true });
      file.write(dataJson);

      try {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: t('Mine SNAR-data'),
          UTI: 'public.json',
        });
        setExportInfo(t('Datafilen er klar. Velg hvor du vil lagre eller dele den.'));
      } catch (sharingError) {

        setExportInfo(t("Datafilen ble opprettet, men delingen kunne ikke åpnes. Prøv igjen."));
      }
    } catch (error) {

      setExportInfo(t("Kunne ikke hente data akkurat nå. Prøv igjen senere."));
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
      setDeleteError(t("Kunne ikke slette kontoen. Prøv igjen når forbindelsen er tilbake."));
      setDeleting(false);
    } finally { deleteLock.current = false; }
  };

  return <V10Screen dock testID="customer-data-screen"><V10Header title={t("Data og personvern")} onBack={() => router.back()} />
    <Text style={v10.secondary}>{t("Her kan du lese personvernerklæringen, hente dine data eller be om sletting av kontoen.")}</Text>
    <V10Section title={t("Personvern og data")}><V10Group>
      <V10Row icon="lock" title={t("Personvernerklæring")} onPress={() => void Linking.openURL('https://kjappapp.no/personvern').catch(() => setExportInfo(t('Kunne ikke åpne lenken. Prøv igjen.')))} testID="privacy-policy" />
      <V10Row border icon="receipt" title={exporting ? t("Henter data…") : t("Last ned mine data")} subtitle={t("Få innsyn i dataene vi lagrer om deg (GDPR)")} onPress={() => void exportData()} disabled={exporting} testID="gdpr-export" />
    </V10Group></V10Section>
    {exportInfo ? <Text accessibilityLiveRegion="polite" style={[v10.secondary, { marginTop: 12 }]} testID="gdpr-export-info">{exportInfo}</Text> : null}
    <V10Section title={t("Konto")}><V10Group>
      <V10Row icon="user" title={t("Konto og profil")} onPress={() => router.push('/customer-account')} testID="privacy-account" />
      <V10Row border icon="bell" title={t("Administrer turvarsler")} onPress={() => router.push('/customer-notifications')} />
      <V10Row border icon="help" title={t("Kontakt kundestøtte")} onPress={() => router.push({ pathname: '/support-chat', params: { topic: 'Personvernforespørsel' } })} />
    </V10Group></V10Section>
    <V10Section title={t("Om appen")}><V10Group>
      <V10Row title={t("Versjon")} right={<Text style={v10.secondary}>{version}{buildNumber ? ` (${buildNumber})` : ''}</Text>} />
      <V10Row border icon="receipt" title={t("Vilkår")} onPress={() => void Linking.openURL('https://kjappapp.no/vilkar').catch(() => setExportInfo(t('Kunne ikke åpne lenken. Prøv igjen.')))} />
    </V10Group></V10Section>
    <View style={{ marginTop: 24 }}><V10Action kind="danger" label={t("Slett konto")} onPress={() => { setDeleteError(''); setDeleteOpen(true); }} testID="gdpr-delete-open" /></View>
    <Text style={[v10.caption, { marginTop: 12 }]}>{t("Sletting fjerner kontoen din permanent. Turer anonymiseres for regnskap.")}</Text>
            <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
              <View style={s.modalBackdrop}>
                <View style={s.modalCard}>
                  <View style={s.modalIcon}><Icon name="shield" size={24} color={colors.danger} /></View>
                  <Text style={s.modalTitle}>{t("Slette kontoen din?")}</Text>
                  <Text style={s.modalBody}>{t("Dette kan ikke angres. Skriv «SLETT» for å bekrefte.")}</Text>
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
                    label={t("Slett konto permanent")}
                    variant="danger"
                    onPress={deleteAccount}
                    loading={deleting}
                    disabled={confirmText.trim().toUpperCase() !== 'SLETT'}
                    testID="gdpr-delete-confirm"
                    style={{ marginTop: 14 }}
                  />
                  <Pressable onPress={() => { setDeleteOpen(false); setConfirmText(''); }} style={{ marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} testID="gdpr-delete-cancel">
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t("Avbryt")}</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
  </V10Screen>;
}

const useStyles = makeStyles((c) => ({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: c.elevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { color: c.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  modalBody: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  modalInput: { alignSelf: 'stretch', marginTop: 16, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, height: 52, color: c.text, fontFamily: font.body, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
}));
