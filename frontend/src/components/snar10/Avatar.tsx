import React, { useState } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Text } from '@/src/components/Typography';
import { colors, font, useColorTheme } from '@/src/theme';
export function Avatar({ name, src, size = 48, initials, onError }: {
  name: string; src?: ImageSourcePropType | string | null; size?: number; initials?: string; onError?: () => void;
}) {
  useColorTheme();
  const source = typeof src === 'string' ? { uri: src } : src;
  const key = typeof src === 'string' ? src : JSON.stringify(src ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const letters = initials ?? name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  return <View style={{ width: size, height: size, borderRadius: size * .34, overflow: 'hidden', backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}>
    {source && failed !== key ? <Image source={source} resizeMode="cover" style={{ width: size, height: size }} onError={() => { setFailed(key); onError?.(); }} />
      : <Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: size * .36 }}>{letters}</Text>}
  </View>;
}
