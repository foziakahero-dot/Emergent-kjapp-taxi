import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { Availability, rideSearchProgress } from '@/src/lib/carAvailability';

function nearbySummary(search: Availability) {
  const count = search.cars.length;
  if (!count) return '';
  const nearest = search.cars
    .filter((car: any) => typeof car?.eta_min === 'number' && Number.isFinite(car.eta_min) && car.eta_min > 0)
    .sort((a: any, b: any) => a.eta_min - b.eta_min)[0] as any;
  const cars = `${count} ledig${count > 1 ? 'e biler' : ' bil'}`;
  if (!nearest) return `${cars} · beregner hentetid`;
  const approximate = nearest.eta_status === 'approximate' || nearest.eta_source === 'distance_fallback';
  return `${cars} · nærmeste ${approximate ? 'ca ' : ''}${Math.ceil(nearest.eta_min)} min`;
}

export function AvailabilityStatus({ search, trip, compact = false }: {
  search: Availability & { now: number; seconds: number | null; retry: () => void }; trip?: any; compact?: boolean;
}) {
  useColorTheme();
  const summary = nearbySummary(search);
  const needsAttention = search.issue === 'offline' || search.issue === 'location';
  const updating = !trip && !needsAttention && search.phase !== 'exhausted';
  const emptyTitle = search.phase === 'exhausted' ? 'Ingen ledige biler i nærheten akkurat nå' : 'Søker etter ledige biler i nærheten…';
  const updateCaption = search.issue === 'empty' ? 'Ingen ledige biler akkurat nå. Vi oppdaterer automatisk.' : 'Ledige biler oppdateres automatisk.';
  if (compact && !trip) {
    const title = search.issue === 'location' ? 'Aktiver posisjon for å se ledige biler innen 5 km.' : search.issue === 'offline' ? 'Kan ikke oppdatere ledige biler akkurat nå.'
      : search.cars.length ? `${summary} i nærheten`
      : emptyTitle;
    return <View testID="availability-status" accessibilityLiveRegion="polite" style={{ paddingTop: 12, gap: 4 }}>
      <Text testID="availability-caption" style={{ color: colors.textSecondary, fontSize: 12 }}>{title}</Text>
      {updating ? <Text testID="availability-auto-update" style={{ color: colors.textMuted, fontSize: 12 }}>{updateCaption}</Text> : null}
      {!search.cars.length && (needsAttention || search.phase === 'exhausted') ? <Pressable testID="availability-retry" accessibilityRole="button" accessibilityLabel="Søk etter ledige biler igjen" onPress={search.retry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontFamily: font.medium, fontSize: 12 }}>Prøv igjen</Text></Pressable> : null}
    </View>;
  }
  const progress = trip ? rideSearchProgress(trip, search.now) : null;
  const title = search.issue === 'location' ? 'Aktiver posisjon for å se ledige biler innen 5 km.' : search.issue === 'offline' ? 'Får ikke oppdatert ledige biler'
    : search.cars.length ? `${summary} innen 5 km`
    : emptyTitle;
  return <View testID="availability-status" accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surface, gap: 4 }}>
    <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 13 }}>{title}</Text>
    {updating ? <Text testID="availability-auto-update" style={{ color: colors.textMuted, fontSize: 12 }}>{updateCaption}</Text> : null}
    {progress ? <Text testID="ride-search-progress" style={{ color: colors.textSecondary, fontSize: 12 }}>Finner nærmeste sjåfør…</Text> : null}
    {!trip && (needsAttention || search.phase === 'exhausted') ? <>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{search.issue === 'offline' ? 'Sjekk nettet ditt og prøv igjen.' : search.issue === 'location' ? 'Tillat posisjon i telefonens innstillinger og prøv igjen.' : 'Prøv igjen om litt.'}</Text>
      <Pressable testID="availability-retry" accessibilityRole="button" accessibilityLabel="Søk etter ledige biler igjen" onPress={search.retry} style={{ paddingVertical: 8 }}><Text style={{ color: colors.accent, fontFamily: font.semibold }}>Prøv igjen</Text></Pressable>
    </> : null}
  </View>;
}
