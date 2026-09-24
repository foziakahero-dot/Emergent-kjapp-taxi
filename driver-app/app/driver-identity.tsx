import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { apiError, driverApi } from '@/src/lib/api';

type Verification = {
  status?: 'not_submitted' | 'pending_review' | 'verified' | 'retry_required' | string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
};

const STATUS: Record<string, { title: string; body: string; tone: 'good' | 'warn' | 'neutral' }> = {
  not_submitted: {
    title: 'Selfie mangler',
    body: 'Ta en fersk selfie slik at KJAPP kan kontrollere at riktig person bruker sjåførkontoen.',
    tone: 'neutral',
  },
  pending_review: {
    title: 'Til kontroll',
    body: 'Selfien er mottatt og venter på kontroll hos KJAPP.',
    tone: 'warn',
  },
  verified: {
    title: 'Identitet verifisert',
    body: 'KJAPP har godkjent den siste identitetskontrollen.',
    tone: 'good',
  },
  retry_required: {
    title: 'Ny selfie kreves',
    body: 'KJAPP trenger en ny selfie før kontrollen kan fullføres.',
    tone: 'warn',
  },
};

export default function DriverIdentity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const camera = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [photo, setPhoto] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try { setVerification(await driverApi.identityVerification()); }
    catch (e) { setErr(apiError(e)); }
  };

  useEffect(() => { void load(); }, []);

  const openCamera = async () => {
    setErr('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErr('Kameratilgang må være aktivert for å ta identitetsselfie.');
        return;
      }
    }
    setPhoto('');
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setErr('');
    try {
      const picture = await camera.current.takePictureAsync({
        quality: 0.78,
        skipProcessing: false,
        exif: false,
      });
      if (!picture?.uri) throw new Error('Kameraet returnerte ikke et bilde');
      setPhoto(picture.uri);
      setCameraOpen(false);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!photo || busy) return;
    setBusy(true);
    setErr('');
    try {
      const result = await driverApi.submitIdentitySelfie(photo);
      setVerification({
        status: result?.status || 'pending_review',
        submitted_at: result?.submitted_at || new Date().toISOString(),
      });
      setPhoto('');
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const status = verification?.status || 'not_submitted';
  const meta = STATUS[status] || STATUS.not_submitted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Identitetskontroll</Text>
            <Text style={s.subtitle}>Selfie ID · KJAPP Driver</Text>
          </View>
        </View>

        {!verification ? <View style={{ paddingVertical: 50 }}><Loader /></View> : (
          <>
            <View style={[s.statusCard, meta.tone === 'good' && s.statusGood, meta.tone === 'warn' && s.statusWarn]}>
              <View style={s.statusIcon}>
                <Icon name={meta.tone === 'good' ? 'check' : 'shield'} size={22} color={meta.tone === 'good' ? colors.online : colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusTitle}>{meta.title}</Text>
                <Text style={s.statusBody}>{meta.body}</Text>
                {verification.review_reason ? <Text style={s.reason}>KJAPP: {verification.review_reason}</Text> : null}
              </View>
            </View>

            <View style={s.infoCard}>
              <Text style={s.infoTitle}>Slik tar du selfien</Text>
              <Text style={s.rule}>• Bruk frontkamera og godt lys.</Text>
              <Text style={s.rule}>• Se rett i kameraet og ha hele ansiktet synlig.</Text>
              <Text style={s.rule}>• Ikke bruk solbriller, maske eller filter.</Text>
              <Text style={s.rule}>• Bildet brukes bare til identitetskontroll hos KJAPP.</Text>
            </View>

            {cameraOpen ? (
              <View style={s.cameraCard}>
                <CameraView ref={camera} style={s.camera} facing="front">
                  <View style={s.faceGuide} />
                </CameraView>
                <Button label={busy ? 'Tar bilde…' : 'Ta selfie'} onPress={() => void capture()} disabled={busy} />
                <Pressable style={s.cancel} onPress={() => setCameraOpen(false)}>
                  <Text style={s.cancelText}>Avbryt</Text>
                </Pressable>
              </View>
            ) : photo ? (
              <View style={s.previewCard}>
                <Image source={{ uri: photo }} style={s.preview} resizeMode="cover" />
                <Button label={busy ? 'Sender…' : 'Send til KJAPP for kontroll'} onPress={() => void submit()} disabled={busy} />
                <Pressable style={s.cancel} onPress={() => void openCamera()}>
                  <Text style={s.cancelText}>Ta nytt bilde</Text>
                </Pressable>
              </View>
            ) : status !== 'pending_review' ? (
              <Button
                label={status === 'verified' ? 'Ta ny identitetsselfie' : 'Åpne frontkamera'}
                onPress={() => void openCamera()}
                testID="driver-identity-camera"
              />
            ) : null}

            <View style={s.privacy}>
              <Icon name="shield" size={18} color={colors.textMuted} />
              <Text style={s.privacyText}>
                Løyvehaver ser bare verifiseringsstatus. Selve selfie-bildet er privat og kan bare åpnes av deg og KJAPP-administratorer.
              </Text>
            </View>
          </>
        )}

        {err ? <Text style={s.error}>{err}</Text> : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.line },
  title: { color: c.text, fontFamily: font.display, fontSize: 25 },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  statusCard: { flexDirection: 'row', gap: 14, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, marginBottom: 16 },
  statusGood: { borderColor: 'rgba(52,211,153,0.28)', backgroundColor: c.onlineSoft },
  statusWarn: { borderColor: 'rgba(203,163,101,0.35)' },
  statusIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  statusTitle: { color: c.text, fontFamily: font.display, fontSize: 19 },
  statusBody: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  reason: { color: c.accent, fontSize: 12, lineHeight: 18, marginTop: 8 },
  infoCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.driverCard, marginBottom: 18 },
  infoTitle: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  rule: { color: c.textSecondary, fontSize: 13, lineHeight: 21 },
  cameraCard: { gap: 12, marginBottom: 18 },
  camera: { height: 440, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  faceGuide: { width: 235, height: 305, borderRadius: 118, borderWidth: 2, borderColor: 'rgba(255,255,255,0.72)', backgroundColor: 'transparent' },
  previewCard: { gap: 12, marginBottom: 18 },
  preview: { width: '100%', height: 440, borderRadius: 24, backgroundColor: '#000' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: c.textMuted, fontSize: 14 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, padding: 15, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)' },
  privacyText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: c.danger, fontSize: 13, lineHeight: 19, marginTop: 14, textAlign: 'center' },
}));
