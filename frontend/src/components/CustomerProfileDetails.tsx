import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/Typography';
import { FigmaGradient } from '@/src/components/FigmaGradient';
import { DesignToggle } from '@/src/components/DesignToggle';
import { Icon, type IconName } from '@/src/components/Icon';
import { Button } from '@/src/components/ui';
import { gdprApi } from '@/src/lib/api';
import { apiError } from '@/src/lib/format';
import { colors, font } from '@/src/theme';

export type ProfileDetail = 'safety' | 'privacy' | 'language';
export function CustomerProfileDetails({ view, onBack, onDelete, onSupport }: { view: ProfileDetail; onBack: () => void; onDelete: () => void; onSupport: () => void }) {
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const exportLock = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const exportData = async () => {
    if (exportLock.current) return;
    exportLock.current = true;
    setExporting(true); setError('');
    try {
      const data = await gdprApi.export();
      if (active.current) await Share.share({ title: 'Mine SNAR-data', message: JSON.stringify(data, null, 2) });
    }
    catch (e) { if (active.current) setError(apiError(e)); }
    finally { exportLock.current = false; if (active.current) setExporting(false); }
  };
  const title = view === 'safety' ? 'Sikkerhetssenter' : view === 'privacy' ? 'Personvern' : 'Språk og tilgjengelighet';
  return <View style={{ flex: 1 }}>
    <FigmaGradient angle={180} colors={['#FFFFFF', '#F2F5FA']} style={StyleSheet.absoluteFill} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 112 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Pressable testID="customer-src-components-CustomerProfileDetails-36" style={s.back} onPress={onBack} accessibilityLabel="Tilbake" accessibilityRole="button"><Icon name="chevron-left" size={16} /></Pressable><Text style={s.title}>{title}</Text></View>
      <View style={{ marginTop: 24, gap: 12 }}>
        {view === 'safety' ? <>
          <Row icon="shield" label="Nødkontakter" sub="Kontakt kundestøtte for hjelp med sikkerhet" onPress={onSupport} color={colors.accent} soft={colors.accentSoft} />
          <UnavailableToggle label="Del turen automatisk" sub="Del sanntidsposisjon med nødkontakter på hver tur" />
          <UnavailableToggle label="RideCheck innsjekk" sub="Sjekker inn ved uventede stopp på lange turer" />
          <Row icon="shield" label="Sjåførverifisering" sub="Se foto og skilt i skjermen for din aktive tur" color={colors.online} soft="rgba(18,185,129,0.12)" />
          <Text style={s.note}>Automatisk deling, nødkontakter og RideCheck er ikke aktivert. Du kan dele en aktiv tur fra turskjermen.</Text>
          <Button testID="customer-src-components-CustomerProfileDetails-44" label="Nødhjelp (112)" icon={<Icon name="shield" size={16} color="#FFFFFF" />} onPress={() => void Linking.openURL('tel:112')} style={{ marginTop: 8 }} />
        </> : view === 'privacy' ? <>
          <Text style={[s.note, { lineHeight: 19.5 }]}>Du bestemmer over dine data. Endre samtykker og kontakt SNAR når som helst.</Text>
          {[
            ['Personalisering', 'Bruk turhistorikk til å forbedre forslag'],
            ['Lagre stedshistorikk', 'Behold besøkte steder for raskere bestilling'],
            ['Analyse og forbedring', 'Anonym bruksstatistikk'],
            ['Markedsføring', 'Tilbud og kampanjer på e-post/SMS'],
          ].map(([label, sub]) => <UnavailableToggle key={label} label={label} sub={sub} />)}
          <Text style={s.note}>Disse samtykkevalgene er ikke aktivert i appen. Kontakt kundestøtte for å administrere personvernforespørsler.</Text>
          <View style={{ marginTop: 8, gap: 12 }}>
            <Row icon="card" label={exporting ? 'Henter data…' : 'Last ned mine data'} sub="Få en kopi av all lagret informasjon" onPress={() => void exportData()} disabled={exporting} testID="privacy-export" />
            <Row icon="x" label="Slett konto og data" sub="Fjerner kontoen din permanent" onPress={onDelete} color={colors.accent} soft={colors.accentSoft} />
          </View>
          {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
          <Text testID="customer-src-components-CustomerProfileDetails-59" style={[s.note, { marginTop: 4, textAlign: 'center', fontSize: 10 }]} onPress={() => void Linking.openURL('https://kjappapp.no/personvern')}>Les personvernerklæringen · kjappapp.no/personvern</Text>
        </> : <>
          <Row icon="globe" label="Språk" sub="Norsk (bokmål)" onPress={() => void Linking.openSettings()} soft={colors.cardSubtle} color={colors.textSecondary} />
          {[
            ['Stor tekst', 'Øk tekststørrelsen'],
            ['Høykontrast', 'Sterkere farger og kontrast'],
            ['Haptisk respons', 'Vibrasjon ved viktige handlinger'],
          ].map(([label, sub]) => <UnavailableToggle key={label} label={label} sub={sub} />)}
          <Text style={s.note}>Tekststørrelse og tilgjengelighet styres av telefonens innstillinger. Egne appvalg for høykontrast og haptisk respons er ikke aktivert.</Text>
          <Pressable testID="customer-src-components-CustomerProfileDetails-68" onPress={() => void Linking.openSettings()} style={s.outline}><Text style={{ color: colors.accent, fontFamily: font.semibold, fontSize: 14 }}>Åpne telefonens innstillinger</Text></Pressable>
        </>}
      </View>
    </ScrollView>
  </View>;
}
function UnavailableToggle({ label, sub }: { label: string; sub: string }) { return <View style={s.card}><View style={{ flex: 1 }}><Text style={s.label}>{label}</Text><Text style={s.sub}>{sub}</Text></View><DesignToggle label={`${label}, ikke aktivert`} value={false} disabled onChange={() => {}} /></View>; }
function Row({ icon, label, sub, onPress, color = colors.accent, soft = colors.accentSoft, disabled, testID }: { icon: IconName; label: string; sub: string; onPress?: () => void; color?: string; soft?: string; disabled?: boolean; testID?: string }) {
  return <Pressable style={s.card} onPress={onPress} disabled={disabled || !onPress} testID={testID} accessibilityRole={onPress ? 'button' : undefined}><View style={[s.icon, { backgroundColor: soft }]}><Icon name={icon} size={20} color={color} /></View><View style={{ flex: 1 }}><Text style={s.label}>{label}</Text><Text style={s.sub}>{sub}</Text></View>{onPress && <Icon name="chevron-right" size={16} color={colors.textMuted} />}</Pressable>;
}
const s = StyleSheet.create({
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: font.semibold, fontSize: 24, letterSpacing: -0.48 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.semibold, fontSize: 14, color: colors.text }, sub: { fontSize: 12, color: colors.textSecondary },
  note: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 }, error: { fontSize: 12, color: colors.danger },
  outline: { alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
});
