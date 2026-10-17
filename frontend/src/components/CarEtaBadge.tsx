import React from 'react';
import { View } from 'react-native';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { MapCarData } from '@/src/lib/liveCars';

export function carEtaLabel(car: MapCarData): string {
  return typeof car.eta_min === 'number' && Number.isFinite(car.eta_min) && car.eta_min > 0
    ? `${Math.ceil(car.eta_min)} min` : 'ETA —';
}

/** A Google road duration, kept upright independently of the car's heading. */
export function CarEtaBadge({ car }: { car: MapCarData }) {
  useColorTheme();
  return <View testID={`driver-eta-${car.id}`} style={{ height: 22, minWidth: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.surfaceInverse, paddingHorizontal: 6 }}>
    <Text style={{ color: colors.onInverse, fontFamily: font.semibold, fontSize: 11, lineHeight: 14 }} numberOfLines={1}>{carEtaLabel(car)}</Text>
  </View>;
}
