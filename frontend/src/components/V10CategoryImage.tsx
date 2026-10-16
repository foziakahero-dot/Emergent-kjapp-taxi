import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

type Kind = 'ai-first' | 'comfort' | 'trygg' | 'premium' | 'suv';
const illustrations = {
  'ai-first': { source: require('../../assets/vehicles/standard-3d.webp'), name: 'Økonomi' },
  premium: { source: require('../../assets/vehicles/premium-3d.webp'), name: 'Premium' },
  trygg: { source: require('../../assets/vehicles/xl-3d.webp'), name: 'XL' },
  suv: { source: require('../../assets/vehicles/suv-category.png'), name: 'SUV' },
};
/** Bundled category illustrations; never a claim about an assigned driver's car. */
export function V10CategoryImage({ kind, selected }: { kind: Kind; selected: boolean }) {
  if (kind === 'comfort') return null;
  const illustration = illustrations[kind];
  return <View style={{ width: 84, height: 50, borderRadius: 12, overflow: 'hidden' }}>
    <Image source={illustration.source} style={{ width: 84, height: 50 }} contentFit="contain"
      accessibilityLabel={`${illustration.name}, bilkategori`} accessibilityRole="image" accessibilityState={{ selected }} />
  </View>;
}
