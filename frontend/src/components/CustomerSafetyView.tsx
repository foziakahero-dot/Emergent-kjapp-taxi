import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Action, V10Group, V10Row, V10Sheet, v10 } from '@/src/components/V10UI';
import { colors, useColorTheme } from '@/src/theme';

export function CustomerSafetyView({ trip, busy, error, onClose, onShare, onReport, onEmergency }: { trip: any; busy: boolean; error: string; onClose: () => void; onShare: () => void; onReport: () => void; onEmergency: () => void }) {
  useColorTheme();
  return <V10Sheet testID="customer-safety-sheet"><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={v10.title}>Sikkerhet</Text><Pressable onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Lukk sikkerhetsmeny" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="x" /></Pressable></View><Text style={[v10.secondary, { marginTop: 4 }]}>Del den aktive turen eller registrer en hendelse hos SNAR.</Text>
    <V10Group style={{ marginTop: 16, backgroundColor: colors.cardSubtle, boxShadow: 'none' }}><V10Row icon="share" title="Del turen live" subtitle="Del lenken med noen du stoler på" onPress={onShare} disabled={busy} testID="safety-share-trip" />
      <V10Row border icon="safety" title={trip.driver?.name || 'Sjåføren din'} subtitle={[trip.driver?.car, trip.driver?.plate].filter(Boolean).join(' · ') || 'Bilinformasjon ikke tilgjengelig'} />
      <V10Row border icon="help" title="Rapporter et problem" subtitle="Registrerer en sikkerhetshendelse knyttet til turen" onPress={onReport} disabled={busy} testID="safety-report" />
    </V10Group>{error ? <Text testID="safety-action-error" accessibilityRole="alert" style={[v10.secondary, { color: colors.danger, marginTop: 12 }]}>{error}</Text> : null}
    <View style={{ marginTop: 16 }}><V10Action label="Ring 112" kind="danger" icon="phone" onPress={onEmergency} busy={busy} testID="safety-call-112" /></View><Text style={[v10.caption, { textAlign: 'center', marginTop: 8 }]}>Ved akutt fare: ring nødnummeret. Telefonappen åpnes direkte. SNAR-support erstatter ikke nødetatene.</Text>
  </V10Sheet>;
}
