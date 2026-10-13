import { Text } from '@/src/components/Typography';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, useColorTheme } from '@/src/theme';
import Svg, { Ellipse } from 'react-native-svg';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Badge, V10Group, V10Header, V10Row, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { Loader } from '@/src/components/ui';
import { apiError, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

type Verification = {
  status?: 'not_submitted' | 'pending_review' | 'verified' | 'retry_required' | string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  recheck_reason?: string | null;
  recheck_trigger?: string | null;
  next_identity_check_at?: string | null;
  identity_verified_at?: string | null;
  recheck_deferred_until_trip_end?: boolean;
};

const STATUS: Record<string, { title: string; body: string; tone: 'good' | 'warn' | 'neutral' }> = {
  not_submitted: {
    title: 'Selfie mangler',
    body: 'Ta en fersk selfie slik at SNAR kan kontrollere at riktig person bruker sjåførkontoen.',
    tone: 'neutral',
  },
  pending_review: {
    title: 'Til kontroll',
    body: 'Selfien er mottatt og venter på kontroll hos SNAR.',
    tone: 'warn',
  },
  verified: {
    title: 'Identitet verifisert',
    body: 'SNAR har godkjent den siste identitetskontrollen.',
    tone: 'good',
  },
  retry_required: {
    title: 'Ny selfie kreves',
    body: 'SNAR trenger en ny selfie før kontrollen kan fullføres.',
    tone: 'warn',
  },
  recheck_required: {
    title: 'Ny identitetskontroll kreves',
    body: 'Ta en ny Selfie ID før neste skift. Dette kan være en planlagt kontroll eller et sikkerhetssignal.',
    tone: 'warn',
  },
};

export default function DriverIdentity() {
  useColorTheme();
  const router = useRouter();
  const { refresh, user } = useAuth();
  const insets = useSafeAreaInsets();
  const camera = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [photo, setPhoto] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const operation = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = async () => {
    setErr('');
    try { const result = await driverApi.identityVerification(); if (!result?.status) throw new Error('Identitetsstatus ble ikke bekreftet.'); if (alive.current) setVerification(result); }
    catch (e) { if (alive.current) setErr(apiError(e)); }
  };

  useEffect(() => { void load(); }, []);

  const openCamera = async () => {
    if (operation.current) return;
    operation.current = true; setErr(''); setBusy(true);
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) { if (alive.current) setErr('Kameratilgang må være aktivert for å ta identitetsselfie.'); return; }
      }
      if (alive.current) { setPhoto(''); setCameraReady(false); setCameraOpen(true); }
    } catch (error) { if (alive.current) setErr(apiError(error)); }
    finally { operation.current = false; if (alive.current) setBusy(false); }
  };

  const capture = async () => {
    if (!camera.current || !cameraReady || operation.current) return;
    operation.current = true;
    setBusy(true);
    setErr('');
    try {
      const picture = await camera.current.takePictureAsync({
        quality: 0.78,
        skipProcessing: false,
        exif: false,
      });
      if (!picture?.uri) throw new Error('Kameraet returnerte ikke et bilde');
      if (alive.current) { setPhoto(picture.uri); setCameraOpen(false); }
    } catch (e) {
      if (alive.current) setErr(apiError(e));
    } finally {
      operation.current = false; if (alive.current) setBusy(false);
    }
  };

  const submit = async () => {
    if (!photo || operation.current) return;
    operation.current = true;
    setBusy(true);
    setErr('');
    try {
      const result = await driverApi.submitIdentitySelfie(photo);
      if (result?.status !== 'pending_review' || !result?.id || !result?.submitted_at) throw new Error('Innsendingen ble ikke bekreftet.');
      if (alive.current) { setVerification(result); setPhoto(''); }
      await refresh();
    } catch (e) {
      if (alive.current) setErr(apiError(e));
    } finally {
      operation.current = false; if (alive.current) setBusy(false);
    }
  };

  const status = verification?.status === 'verified' && user?.identity_recheck_required ? 'recheck_required' : verification?.status || 'not_submitted';
  const meta = STATUS[status] || { title: 'Ukjent kontrollstatus', body: 'Oppdater kontrollstatus før du fortsetter.', tone: 'neutral' as const };

  if (cameraOpen || photo) return <View testID="driver-identity-camera-screen" style={{ flex: 1, backgroundColor: '#0a141f', alignItems: 'center', paddingTop: Math.max(110, insets.top + 48), paddingHorizontal: 24 }}>
    <StatusBar style="light" />
    <View style={{ width: 240, height: 300 }}>
      <View style={{ position: 'absolute', inset: 0, borderRadius: 120, overflow: 'hidden' }}>{photo ? <Image source={{ uri: photo }} style={{ width: 240, height: 300 }} resizeMode="cover" /> : <CameraView ref={camera} testID="driver-selfie-live-camera" style={{ width: 240, height: 300 }} facing="front" onCameraReady={() => setCameraReady(true)} onMountError={() => { setErr('Kameraet kunne ikke åpnes. Prøv igjen.'); setCameraOpen(false); }} />}</View>
      <Svg width={240} height={300} viewBox="0 0 240 300" pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><Ellipse cx={120} cy={150} rx={116} ry={146} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={3} strokeDasharray={[12, 6]} /></Svg>
    </View><Text style={[v10.heading, { color: '#eef2f7', marginTop: 32, textAlign: 'center' }]}>{photo ? 'Kontroller bildet ditt' : 'Hold telefonen i øyehøyde'}</Text><Text style={[v10.secondary, { color: 'rgba(238,242,247,.65)', marginTop: 6, textAlign: 'center' }]}>{photo ? 'Send selfien til SNAR for manuell kontroll.' : 'Ha hele ansiktet synlig. Trykk for å ta selfien.'}</Text>
    {err ? <Text testID="driver-identity-error" accessibilityRole="alert" style={[v10.secondary, { color: '#ffb4ba', marginTop: 16 }]}>{err}</Text> : null}
    <View style={{ position: 'absolute', bottom: Math.max(40, insets.bottom + 6), left: 24, right: 24, gap: 4 }}><V10Action label={photo ? 'Send til kontroll' : 'Ta selfie'} onPress={() => void (photo ? submit() : capture())} busy={busy} disabled={!photo && !cameraReady} testID={photo ? 'driver-selfie-submit' : 'driver-selfie-capture'} /><V10Action kind="soft" label={photo ? 'Ta nytt bilde' : 'Avbryt'} disabled={busy} onPress={() => { if (photo) void openCamera(); else setCameraOpen(false); }} testID="driver-selfie-cancel" /></View>
  </View>;
  return <V10Screen testID="driver-identity-screen"><V10Header onBack={() => router.back()} />
    {!verification ? err ? <V10State warning icon="wifiOff" title="Kunne ikke hente identitetsstatus" body={err} action="Prøv igjen" onAction={() => void load()} /> : <Loader /> : <>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="camera" size={26} /></View><Text style={[v10.title, { marginTop: 18 }]}>Bekreft at det er deg</Text><Text style={[v10.secondary, { marginTop: 8 }]}>Passasjerer stoler på at sjåføren i appen er den som kjører. Ta en fersk selfie. SNAR kontrollerer bildet manuelt.</Text>
      <View style={{ marginTop: 16, gap: 6 }}><V10Badge tone={meta.tone === 'good' ? 'positive' : meta.tone === 'warn' ? 'warning' : 'neutral'}>{meta.title}</V10Badge><Text style={v10.secondary}>{meta.body}</Text>
        {verification.review_reason ? <Text style={v10.caption}>SNAR: {verification.review_reason}</Text> : null}{verification.recheck_reason ? <Text style={v10.caption}>Kontrollårsak: {verification.recheck_reason}</Text> : null}
        {verification.recheck_deferred_until_trip_end ? <Text style={v10.caption}>Kontrollen aktiveres når den aktive turen er avsluttet.</Text> : null}
        {verification.next_identity_check_at && status === 'verified' && Number.isFinite(new Date(verification.next_identity_check_at).getTime()) ? <Text style={v10.caption}>Neste planlagte kontroll: {new Date(verification.next_identity_check_at).toLocaleDateString('nb-NO')}</Text> : null}
      </View>
      <V10Group style={{ marginTop: 20 }}><V10Row icon="sun" title="Godt lys foran deg" /><V10Row border icon="user" title="Ta av lue og solbriller" /><V10Row border icon="lock" title="Kun brukt til verifisering" /></V10Group>
      <View style={{ marginTop: 24 }}>{status !== 'pending_review' ? <V10Action label={status === 'verified' ? 'Ta ny identitetsselfie' : 'Start kamera'} onPress={() => void openCamera()} busy={busy} testID="driver-identity-camera" /> : <V10Action kind="soft" label="Sjekk kontrollstatus" onPress={() => void load()} testID="driver-identity-refresh" />}</View>
      {status === 'verified' && user?.approved === true && !user.identity_recheck_required ? <View style={{ marginTop: 8 }}><V10Action kind="ink" label="Fortsett" onPress={() => router.replace('/')} testID="driver-identity-continue" /></View> : null}
      {!permission?.granted && permission?.canAskAgain === false ? <V10Action kind="ghost" label="Åpne kamerainnstillinger" onPress={() => void Linking.openSettings().catch(() => setErr('Kunne ikke åpne telefonens innstillinger.'))} /> : null}
      {err ? <Text testID="driver-identity-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{err}</Text> : null}<Text style={[v10.caption, { marginTop: 16 }]}>Løyvehaver ser bare verifiseringsstatus. Selfien er privat og kan bare åpnes av deg og SNAR-administratorer.</Text>
    </>}
  </V10Screen>;
}
