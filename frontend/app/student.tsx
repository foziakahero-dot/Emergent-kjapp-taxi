import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/src/components/Typography';
import { api } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, useColorTheme } from '@/src/theme';

type StudentStatus = { status: string; eligible: boolean; valid_until?: string; reason?: string };
const labels: Record<string, string> = { not_submitted: 'Ikke sendt inn', pending: 'Venter på kontroll',
  verified: 'Studentstatus godkjent', rejected: 'Ikke godkjent', revoked: 'Godkjenning trukket tilbake',
  expired: 'Godkjenningen er utløpt', needs_resubmission: 'Send dokumentasjon på nytt' };

export default function Student() {
  useColorTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [institution, setInstitution] = useState('');
  const [until, setUntil] = useState('');
  const [consent, setConsent] = useState(false);
  const [proof, setProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    api.get<StudentStatus>('/me/student-verification').then(r => { if (active) setStatus(r.data); })
      .catch(e => { if (active) setError(apiError(e)); });
    return () => { active = false; };
  }, []);
  const choose = async () => {
    if (lock.current) return;
    lock.current = true; setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.fileSize || 0) > 5 * 1024 * 1024) throw new Error('Bildet kan være maks 5 MB.');
      setProof(asset);
    } catch (e) { setError(apiError(e)); }
    finally { lock.current = false; }
  };
  const submit = async () => {
    if (lock.current || !proof || !consent || !institution.trim()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error('Skriv gyldighetsdato som ÅÅÅÅ-MM-DD.');
      const form = new FormData();
      form.append('institution', institution.trim()); form.append('valid_until', until); form.append('consent', 'true');
      if (Platform.OS === 'web') form.append('file', await (await fetch(proof.uri)).blob(), proof.fileName || 'student.jpg');
      else form.append('file', { uri: proof.uri, name: proof.fileName || 'student.jpg', type: proof.mimeType || 'image/jpeg' } as any);
      const r = await api.post<StudentStatus>('/me/student-verification', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStatus(r.data); setProof(null); setConsent(false);
    } catch (e) {
      const detail = (e as any)?.response?.data?.detail;
      setError(Array.isArray(detail) ? 'Kontroller studiested, dato og dokument. Datoen må være innen ett år.' : apiError(e));
    } finally { lock.current = false; setBusy(false); }
  };
  const withdraw = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await api.delete('/me/student-verification'); setStatus({ status: 'not_submitted', eligible: false }); }
    catch (e) { setError(apiError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const button = { minHeight: 48, justifyContent: 'center' as const, padding: 14, borderRadius: 14, backgroundColor: colors.cardSubtle };
  const input = { minHeight: 52, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, color: colors.text };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, gap: 18 }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={button}><Text>‹ Tilbake</Text></Pressable>
    <Text style={{ fontSize: 30, fontWeight: '700' }}>SNAR Student</Text>
    <Text>Bekreft at du er student. Eventuelle studentpriser og vilkår publiseres før de tas i bruk. Verifisering gir foreløpig ingen rabatt.</Text>
    {status ? <View accessibilityLiveRegion="polite"><Text style={{ fontWeight: '700' }}>{labels[status.status] || status.status}</Text>
      {status.valid_until ? <Text>Gyldig til: {status.valid_until}</Text> : null}
      {status.reason ? <Text>{status.reason}</Text> : null}</View> : null}
    {status?.status !== 'pending' && !status?.eligible ? <>
      <Text>Last opp et leselig bilde av studentbevis eller semesterbekreftelse med navn, studiested og gyldighet. Skjul fødselsnummer og andre unødvendige opplysninger. Bildet er privat og slettes etter kontroll. Dokumenttilgangen stenges etter sju dager, og bildet slettes automatisk.</Text>
      <TextInput accessibilityLabel="Studiested" placeholder="Studiested" maxLength={120} value={institution} onChangeText={setInstitution} style={input} />
      <TextInput accessibilityLabel="Gyldig til, ÅÅÅÅ-MM-DD" placeholder="Gyldig til: ÅÅÅÅ-MM-DD" value={until} onChangeText={setUntil} maxLength={10} style={input} />
      <Pressable accessibilityRole="button" onPress={() => void choose()} disabled={busy} style={button}><Text>{proof ? 'Dokument valgt – velg et annet' : 'Velg bilde av studentbevis'}</Text></Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(v => !v)} disabled={busy} style={button}><Text>{consent ? '☑' : '☐'} Jeg godtar at SNAR kontrollerer dokumentet for å verifisere studentstatusen min.</Text></Pressable>
      <Pressable testID="student-submit" accessibilityRole="button" disabled={busy || !proof || !consent || !institution.trim()} onPress={() => void submit()} style={[button, { opacity: !proof || !consent ? .5 : 1 }]}><Text>Send til kontroll</Text></Pressable>
    </> : null}
    {status && status.status !== 'not_submitted' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void withdraw()} style={button}><Text>Trekk tilbake og slett studentstatus</Text></Pressable> : null}
    {busy ? <ActivityIndicator accessibilityLabel="Sender" color={colors.accent} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
  </ScrollView>;
}
