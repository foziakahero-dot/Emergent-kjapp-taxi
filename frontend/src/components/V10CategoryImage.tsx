import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { V10Icon } from '@/src/components/V10Icon';
import { VehicleAsset } from '@/src/components/VehicleAsset';

type Kind = 'ai-first' | 'comfort' | 'trygg' | 'premium';
const photos: Record<Kind, { id: string; name: string }> = {
  'ai-first': { id: 'photo-1560958089-b8a1929cea89', name: 'Standard' },
  comfort: { id: 'photo-1580273916550-e323be2ae537', name: 'Comfort' },
  trygg: { id: 'photo-1549317661-bd32c8ce0db2', name: 'XL' },
  premium: { id: 'photo-1563720223185-11003d516935', name: 'Premium' },
};

/** Original source category photography; illustrative, never an assigned vehicle. */
export function V10CategoryImage({ kind, selected }: { kind: Kind; selected: boolean }) {
  const [failed, setFailed] = useState<Kind | null>(null);
  const photo = photos[kind];
  return <View style={{ width: 84, height: 50, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
    {failed === kind ? kind === 'comfort'
      ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><V10Icon name="vehicle" color="#0b1a2c" /></View>
      : <VehicleAsset kind={kind} width={84} height={50} selected={selected} />
      : <Image source={{ uri: `https://images.unsplash.com/${photo.id}?q=80&w=900&auto=format&fit=crop` }} style={{ width: 84, height: 50 }} contentFit="cover" cachePolicy="memory-disk" onError={() => setFailed(kind)} accessibilityLabel={`${photo.name}, kjøretøyillustrasjon`} accessibilityRole="image" />}
  </View>;
}
