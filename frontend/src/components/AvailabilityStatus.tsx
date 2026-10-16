import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { Availability, rideSearchProgress } from '@/src/lib/carAvailability';

export function AvailabilityStatus({ search, trip, compact = false }: {
  search: Availability & { now: number; seconds: number | null; retry: () => void }; trip?: any; compact?: boolean;
}) {
  useColorTheme();
  if (compact && !trip) {
    const title = search.issue === 'location' ? 'Aktiver posisjon for å se ledige biler innen 5 km.' : search.issue === 'offline' ? 'Kan ikke oppdatere ledige biler akkurat nå.'
      : search.cars.length ? `${search.cars.length} ledig${search.cars.length > 1 ? 'e biler' : ' bil'} i nærheten`
      : search.issue === 'empty' ? 'Ingen ledige biler i nærheten akkurat nå.' : 'Ledige biler vises på kartet.';
    return <View testID="availability-status" style={{ paddingTop: 12, gap: 4 }}>
      <Text testID="availability-caption" style={{ color: colors.textSecondary, fontSize: 12 }}>{title}</Text>
      {search.issue === 'offline' || search.issue === 'location' || search.phase === 'exhausted' ? <Pressable testID="availability-retry" accessibilityRole="button" accessibilityLabel="Oppdater ledige biler" onPress={search.retry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontFamily: font.medium, fontSize: 12 }}>Oppdater</Text></Pressable> : null}
    </View>;
  }
  const progress = trip ? rideSearchProgress(trip, search.now) : null;
  const title = search.issue === 'location' ? 'Aktiver posisjon for å se ledige biler innen 5 km.' : search.issue === 'offline' ? 'Får ikke oppdatert ledige biler'
    : search.cars.length ? `${search.cars.length} ledig${search.cars.length > 1 ? 'e biler' : ' bil'} innen 5 km`
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
