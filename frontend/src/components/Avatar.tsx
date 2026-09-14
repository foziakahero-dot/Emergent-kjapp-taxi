import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, font } from '@/src/theme';

export function Avatar({
  name,
  uri,
  size = 76,
  onPress,
  accent = colors.accent,
  testID,
}: {
  name?: string;
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  editable?: boolean;
  accent?: string;
  testID?: string;
}) {
  const initials = (name || 'KJAPP')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const body = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(8,13,17,0.92)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={160} />
      ) : (
        <Text style={{ color: accent, fontFamily: font.display, fontSize: Math.round(size * 0.34) }}>
          {initials}
        </Text>
      )}
    </View>
  );

  if (!onPress) return body;
  return <Pressable onPress={onPress} testID={testID}>{body}</Pressable>;
}
