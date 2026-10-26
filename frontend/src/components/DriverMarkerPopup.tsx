import React from 'react';
import { carEtaLabel } from './CarEtaBadge';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { MapCarData } from '@/src/lib/liveCars';

export function DriverMarkerPopup({ car, onClose, style }: {
  car: MapCarData; onClose: () => void; style?: StyleProp<ViewStyle>;
}) {
  useColorTheme();
  const rating = typeof car.rating === 'number' && Number.isFinite(car.rating)
    ? `${car.rating.toFixed(1)} av 5` : 'Ingen vurderinger ennå';
  return <View testID="driver-marker-popup" accessibilityLiveRegion="polite" style={[{
    position: 'absolute', left: 16, right: 16, padding: 14, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  }, style]}>
    <View style={{ flex: 1, gap: 3 }}>
      <Text testID="marker-driver-name" style={{ color: colors.text, fontFamily: font.semibold, fontSize: 14 }}>{car.name || 'Sjåfør'}</Text>
      <Text testID="marker-car-model" style={{ color: colors.textSecondary, fontSize: 13 }}>{car.car || 'Bilmodell ikke oppgitt'}</Text>
      <Text testID="marker-driver-eta" style={{ color: colors.textSecondary, fontSize: 12 }}>{carEtaLabel(car)} til hentestedet</Text>
      {car.distance_km != null ? <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Avstanden er beregnet i luftlinje.</Text> : null}
      <Text testID="marker-driver-rating" style={{ color: colors.textSecondary, fontSize: 12 }}>{rating}</Text>
    </View>
    <Pressable testID="close-driver-marker" accessibilityRole="button" accessibilityLabel="Lukk sjåførinformasjon" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, color: colors.text }}>×</Text>
    </Pressable>
  </View>;
}
