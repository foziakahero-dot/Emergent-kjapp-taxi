import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

type Kind = 'ai-first' | 'comfort' | 'trygg' | 'premium' | 'suv';
const illustrations = {
  'ai-first': { source: require('../../assets/figma-v2/standard.jpg'), name: 'Standard' },
  premium: { source: require('../../assets/figma-v2/premium.jpg'), name: 'Premium' },
  trygg: { source: require('../../assets/vehicles/xl-3d.webp'), name: 'XL' },
  suv: { source: require('../../assets/vehicles/suv-category.png'), name: 'SUV' },
};
/** Standard/Premium use the exact source CustomerApp CARS URLs, bundled locally.
 * Extra backend classes retain their existing art; no class is relabelled as Comfort. */
export function V10CategoryImage({ kind, selected }: { kind: Kind; selected: boolean }) {
  if (kind === 'comfort') return null;
  const illustration = illustrations[kind];
  return <View style={{ width: 84, height: 50, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
    <Image source={illustration.source} style={{ width: 84, height: 50 }} contentFit={kind === 'suv' || kind === 'trygg' ? 'contain' : 'cover'}
      accessibilityLabel={`${illustration.name}, bilkategori`} accessibilityRole="image" accessibilityState={{ selected }} />
  </View>;
}
