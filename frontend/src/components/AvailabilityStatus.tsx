import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors, font } from '@/src/theme';
import { Availability, rideSearchProgress } from '@/src/lib/carAvailability';

export function AvailabilityStatus({ search, trip }: {
  search: Availability & { now: number; seconds: number | null; retry: () => void }; trip?: any;
}) {
  const progress = trip ? rideSearchProgress(trip, search.now) : null;
  const title = search.issue === 'offline' ? 'Får ikke oppdatert ledige biler'
    : search.cars.length ? `${search.cars.length} ledig${search.cars.length > 1 ? 'e biler' : ' bil'} nær hentestedet`
    : search.phase === 'loading' ? 'Søker etter ledige biler…' : 'Ingen ledig bil akkurat nå';
  return <View testID="availability-status" accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surface, gap: 4 }}>
    <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 13 }}>{title}</Text>
    {progress ? <Text testID="ride-search-progress" style={{ color: colors.textSecondary, fontSize: 12 }}>{progress.label} · {progress.detail}</Text>
      : search.issue && search.phase !== 'exhausted' ? <Text testID="availability-progress" style={{ color: colors.textSecondary, fontSize: 12 }}>Forsøk {search.attempt} av 3 · {search.phase === 'loading' ? 'Søker…' : `${search.attempt === 3 ? 'Søket avsluttes' : 'Neste forsøk'} om ${search.seconds ?? 30} sekunder`}</Text> : null}
    {!trip && search.phase === 'exhausted' ? <>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{search.issue === 'offline' ? 'Sjekk nettet ditt. Vil du prøve igjen om litt?' : 'Vi fant ingen bil etter tre forsøk. Vil du prøve igjen om litt?'}</Text>
      <Pressable testID="availability-retry" accessibilityRole="button" onPress={search.retry} style={{ paddingVertical: 8 }}><Text style={{ color: colors.accent, fontFamily: font.semibold }}>Prøv igjen</Text></Pressable>
    </> : null}
  </View>;
}
