import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import type { Availability } from '@/src/lib/carAvailability';

export function DriverAvailabilityBadge({ search, ready }: { search: Availability; ready: boolean }) {
  useColorTheme();
  const live = ready && search.issue !== 'offline' && search.cars.length > 0;
  const title = !ready ? 'Velg hentested for å se ledige sjåfører'
    : search.issue === 'offline' ? 'Sjåførstatus er utilgjengelig'
    : live ? `${search.cars.length} ledig${search.cars.length === 1 ? '' : 'e'} sjåfør${search.cars.length === 1 ? '' : 'er'} · Live`
    : search.issue === 'empty' ? 'Ingen ledige sjåfører innen 5 km' : 'Oppdaterer ledige sjåfører…';
  return <View testID="home-driver-status" accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: colors.surface, boxShadow: colors.elevation2 }}>
    <View testID="driver-status-indicator" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: live ? colors.online : colors.textMuted }} />
    <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.text }}>{title}</Text>
  </View>;
}
