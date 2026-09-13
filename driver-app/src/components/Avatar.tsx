import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, font } from '@/src/theme';
import { storage } from '@/src/utils/storage';
import { TOKEN_KEY } from '@/src/lib/api';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://github-app-builder-28.emergent.host').replace(/\/$/, '');

export function Avatar({ name, uri, size = 88 }: { name?: string; uri?: string | null; size?: number }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { storage.getItem(TOKEN_KEY).then(setToken).catch(() => {}); }, []);

  const initials = (name || 'SJ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isRemote = !!uri && /^https?:\/\//i.test(uri);
  const imageUri = uri ? (isRemote ? uri : `${BACKEND}/api/files/${uri.replace(/^\//, '')}`) : null;

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
      {imageUri ? (
        <Image
          source={{ uri: imageUri, headers: !isRemote && token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <Text style={{ color: colors.online, fontFamily: font.display, fontSize: Math.round(size * 0.33) }}>{initials}</Text>
      )}
    </View>
  );
}
