import React from 'react';
import { Image, Text, View } from 'react-native';
import { colors, font } from '@/src/theme';

export function Avatar({ name, uri, size = 88 }: { name?: string; uri?: string | null; size?: number }) {
  const initials = (name || 'SJ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.onlineSoft,
        borderWidth: 1,
        borderColor: 'rgba(47,224,140,0.30)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ color: colors.online, fontFamily: font.display, fontSize: Math.round(size * 0.33) }}>{initials}</Text>
      )}
    </View>
  );
}
