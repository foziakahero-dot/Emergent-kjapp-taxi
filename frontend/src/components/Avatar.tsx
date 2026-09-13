import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, font } from '@/src/theme';
import { Icon } from './Icon';
import { storage } from '@/src/utils/storage';
import { TOKEN_KEY } from '@/src/lib/api';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');
const CURRENT_PROFILE_PHOTO_KEY = 'kjapp_profile_photo_current';

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
  const [token, setToken] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    storage.getItem(TOKEN_KEY).then(setToken).catch(() => {});
    if (!uri) storage.getItem(CURRENT_PROFILE_PHOTO_KEY).then(setLocalUri).catch(() => {});
    else setLocalUri(null);
  }, [uri]);

  const initials = (name || 'KJAPP')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const effectiveUri = uri || localUri;
  const isRemote = !!effectiveUri && /^https?:\/\//i.test(effectiveUri);
  const imageUri = effectiveUri ? (isRemote ? effectiveUri : `${BACKEND}/api/files/${effectiveUri.replace(/^\//, '')}`) : null;

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
      {imageUri ? (
        <Image
          source={{ uri: imageUri, headers: !isRemote && token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={180}
        />
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
