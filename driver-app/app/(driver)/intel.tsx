import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/src/context/AuthContext';
import { driverApi } from '@/src/lib/api';
import { usableDemand } from '@/src/lib/demand';
import { Text } from '@/src/components/Typography';
import { Map } from '@/src/components/Map';
import { V10Action, V10Group, V10Screen, V10State, v10 } from '@/src/components/V10UI';
import { V10Icon } from '@/src/components/V10Icon';
import { V10Entrance } from '@/src/components/V10Entrance';
import { colors, useColorTheme } from '@/src/theme';

export default function DriverIntelligence() {
  useColorTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const demand = useQuery({ queryKey: ['driver-demand', user?.id], queryFn: driverApi.demand,
    enabled: !!user?.id && focused, refetchInterval: focused ? 60000 : false });
  // Hide cached cells and navigation when a refresh fails or data has expired.
  const { cells, zones } = usableDemand(demand.isError || !focused ? null : demand.data);
  const best = zones[0];
  const hasData = cells.length > 0;
  const navigate = async () => {
    if (!best) return;
    setNavigationError('');
    try { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lng}&travelmode=driving`); }
    catch { setNavigationError('Kunne ikke åpne navigasjon. Prøv igjen.'); }
  };
  return <V10Screen dock testID="driver-intelligence"><V10Entrance fade>
    <Text style={[v10.overline, { marginTop: 8 }]}>SNAR Drive Intelligence</Text>
    <Text style={[v10.title, { marginTop: 4 }]}>{hasData ? 'Etterspørselen rundt deg.' : 'Ingen oppdatert prognose ennå.'}</Text>
    <View style={{ height: 160, borderRadius: 24, overflow: 'hidden', marginTop: 20, boxShadow: colors.elevation1, backgroundColor: colors.cardSubtle }}>
      {hasData ? <Map testID="driver-demand-map" demand={cells} interactive={false} style={{ flex: 1 }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}><V10Icon name="navigation" size={32} color={colors.textMuted} /><Text style={[v10.caption, { textAlign: 'center' }]}>{demand.isPending ? 'Henter etterspørsel…' : 'Prognosekart er ikke tilgjengelig'}</Text></View>}
    </View>
    {demand.isError ? <V10State icon="wifiOff" title="Kunne ikke hente etterspørsel" body="Sjekk forbindelsen og prøv igjen." action="Prøv igjen" onAction={() => void demand.refetch()} /> : null}
    <View style={{ gap: 8, marginTop: 12 }}>{zones.length ? zones.map((zone, index) => <V10Entrance key={`${zone.lat}:${zone.lng}`} delay={index * 60}>
      <V10Group style={{ padding: 16, flexDirection: 'row', gap: 14 }}><View style={v10.icon}><V10Icon name="navigation" size={20} /></View><View style={{ flex: 1 }}>
        <Text style={v10.body}>{zone.label || 'Område med etterspørsel'}</Text><Text style={v10.secondary}>{zone.recent} bestillinger siste {demand.data?.window_minutes ?? 90} min · {zone.drivers} ledige sjåfører</Text><Text style={[v10.caption, { marginTop: 6 }]}>Historikk og tilgjengelighet · ingen inntektsgaranti</Text>
      </View></V10Group>
    </V10Entrance>) : [
      ['clock', 'Etterspørsel', 'Ingen oppdatert prognose for området ditt.'],
      ['earnings', 'Inntektsestimat', 'Vi har ikke grunnlag for et inntektsestimat ennå.'],
      ['battery', 'Lading', 'Ladestatus og ledige ladesteder er ikke tilgjengelige her.'],
    ].map(([icon, title, body]) => <V10Group key={icon} style={{ padding: 16, flexDirection: 'row', gap: 14 }}><View style={v10.icon}><V10Icon name={icon} size={20} /></View><View style={{ flex: 1 }}><Text style={v10.body}>{title}</Text><Text style={v10.secondary}>{body}</Text></View></V10Group>)}</View>
    {navigationError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{navigationError}</Text> : null}
    <View style={{ marginTop: 20 }}><V10Action label={best?.label ? `Kjør mot ${best.label}` : 'Kjør mot anbefalt område'} icon="navigation" iconSize={20} disabled={!best} onPress={() => void navigate()} testID="driver-intelligence-navigate" /></View>
    <V10Action label="Bli der jeg er" kind="ghost" onPress={() => router.navigate('/(driver)/home')} testID="driver-intelligence-stay" />
    <Text style={[v10.caption, { textAlign: 'center' }]}>Forslag er alltid valgfrie og påvirker ikke turtildeling.</Text>
  </V10Entrance></V10Screen>;
}
