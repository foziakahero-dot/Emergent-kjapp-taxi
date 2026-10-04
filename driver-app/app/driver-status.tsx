import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, makeStyles } from '@/src/theme';
import { Icon } from '@/src/components/Icon';
import { Button, Loader } from '@/src/components/ui';
import { driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';

type Doc = {
  doc_type: string;
  label: string;
  status: 'valid' | 'rejected' | 'pending' | 'missing' | string;
  reason?: string | null;
  expiry?: string | null;
  uploaded_at?: string | null;
  reviewed_at?: string | null;
};

const statusCopy = (status: string) => {
  if (status === 'valid') return 'Godkjent';
  if (status === 'rejected') return 'Avvist';
  if (status === 'missing') return 'Mangler';
  return 'Til vurdering';
};

export default function DriverStatus() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const s = useStyles();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await driverApi.documents();
      setData(next);
      await refresh();
      if (next?.approved === true) {
        router.replace('/(driver)/home');
      }
    } catch {
      setError('Kunne ikke hente dokumentstatus. Prøv igjen.');
    }
  }, [refresh, router]);

  useEffect(() => { void load(); }, [load]);

  if (!data && !error) {
    return <View style={[s.screen, s.center]}><Loader /></View>;
  }

  const docs: Doc[] = data?.documents || [];
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 30, paddingHorizontal: 20 }}>
      <View style={s.brandRow}>
        <View>
          <Text style={s.eyebrow}>KJAPP DRIVER</Text>
          <Text style={s.title}>Dokumentstatus</Text>
        </View>
        <Pressable onPress={() => void load()} style={s.refresh} accessibilityLabel="Oppdater dokumentstatus">
          <Icon name="refresh-cw" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={s.infoCard}>
        <Icon name="shield" size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.infoTitle}>{data?.all_valid ? 'Dokumentene er klare' : 'Kontoen venter på godkjenning'}</Text>
          <Text style={s.infoText}>
            {data?.all_valid
              ? 'Alle dokumenter er godkjent. KJAPP aktiverer sjåførkontoen når den siste kontrollen er fullført.'
              : 'Du får ikke gå online eller motta turer før alle påkrevde dokumenter er godkjent.'}
          </Text>
        </View>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Text style={s.section}>Dokumenter</Text>
      <View style={s.card}>
        {docs.map((doc, index) => (
          <View key={doc.doc_type} style={[s.docRow, index > 0 && s.border]}>
            <View style={[s.statusDot, doc.status === 'valid' ? s.ok : doc.status === 'rejected' || doc.status === 'missing' ? s.bad : s.pending]} />
            <View style={{ flex: 1 }}>
              <Text style={s.docLabel}>{doc.label}</Text>
              <Text style={s.docStatus}>{statusCopy(doc.status)}</Text>
              {doc.reason ? <Text style={s.reason}>Begrunnelse: {doc.reason}</Text> : null}
              {doc.expiry ? <Text style={s.meta}>Gyldig til: {doc.expiry}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <View style={s.help}>
        <Text style={s.helpTitle}>Må et dokument sendes inn på nytt?</Text>
        <Text style={s.helpText}>Kontakt KJAPP eller løyvehaveren din. Ny sikker opplastingsflyt fra Driver-appen legges til separat; ikke send sensitive dokumenter i vanlig e-post.</Text>
        <Button label="Kontakt KJAPP" onPress={() => Linking.openURL('mailto:support@kjapp.no?subject=Driver%20dokumentstatus')} style={{ marginTop: 12 }} />
      </View>

      {user?.approved === true ? (
        <Button label="Til Driver" onPress={() => router.replace('/(driver)/home')} style={{ marginTop: 18 }} />
      ) : null}

      <Pressable
        style={s.logout}
        onPress={async () => { await logout(); router.replace('/driver-login'); }}
      >
        <Text style={s.logoutText}>Logg ut</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.driverBg },
  center: { alignItems: 'center', justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: c.online, fontFamily: font.bold, fontSize: 10, letterSpacing: 1.8 },
  title: { color: c.text, fontFamily: font.display, fontSize: 28, marginTop: 5 },
  refresh: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  infoCard: { flexDirection: 'row', gap: 12, marginTop: 22, padding: 16, borderRadius: 18, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.line },
  infoTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  infoText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  error: { color: c.danger, marginTop: 14 },
  section: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: c.driverCard, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16 },
  docRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  border: { borderTopWidth: 1, borderTopColor: c.line },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  ok: { backgroundColor: c.online },
  bad: { backgroundColor: c.danger },
  pending: { backgroundColor: c.accent },
  docLabel: { color: c.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  docStatus: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  reason: { color: c.danger, fontSize: 12, lineHeight: 17, marginTop: 5 },
  meta: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  help: { marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: c.cardSubtle, borderWidth: 1, borderColor: c.line },
  helpTitle: { color: c.text, fontWeight: '600', fontSize: 14 },
  helpText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  logout: { marginTop: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: c.textMuted, fontSize: 14 },
}));
