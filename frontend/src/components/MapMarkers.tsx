import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { V10VehicleMarker } from './V10VehicleMarker';
import { colors, font, useColorTheme } from '@/src/theme';

export { V10VehicleMarker as MapCar } from './V10VehicleMarker';

export function PositionDot() {
  return <View testID="customer-position-marker" accessible accessibilityLabel="Din posisjon" style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#2674D9', borderWidth: 3, borderColor: '#FFFFFF' }} />
  </View>;
}

export function AvailableDriverMarker({ heading = 0, eta }: { heading?: number; eta?: number }) {
  useColorTheme();
  const minutes = Number.isFinite(eta) && Number(eta) > 0 ? Math.ceil(Number(eta)) : null;
  return <View testID="available-driver-marker" accessible accessibilityLabel={`Ledig sjåfør${minutes ? `, ${minutes} minutter unna` : ''}`}
    style={{ width: 86, height: 76, alignItems: 'center' }}>
    <View style={{ height: 22, borderRadius: 11, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: colors.online }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 10, color: '#FFFFFF' }}>LEDIG{minutes ? ` · ${minutes} min` : ''}</Text>
    </View>
    <V10VehicleMarker heading={heading} />
  </View>;
}
