import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { colors, font } from '@/src/theme';
import { Icon } from './Icon';

export function Avatar({
  name,
  uri,
  size = 76,
  onPress,
  editable = false,
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={{ color: accent, fontFamily: font.display, fontSize: Math.round(size * 0.34) }}>
          {initials}
        </Text>
      )}
    </View>
  );

  if (!editable && !onPress) return body;

  return (
    <Pressable onPress={onPress} disabled={!onPress} testID={testID} style={{ position: 'relative' }}>
      {body}
      {editable ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent,
            borderWidth: 3,
            borderColor: colors.bg,
          }}
        >
          <Icon name="camera" size={14} color={colors.accentOn} />
        </View>
      ) : null}
    </Pressable>
  );
}
