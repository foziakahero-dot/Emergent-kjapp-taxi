import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFileSource } from '@/src/lib/api';
import { Text } from '@/src/components/Typography';
import { colors, font, useColorTheme } from '@/src/theme';

/** Source avatar geometry, with the signed-in driver's authenticated photo. */
export function DriverAvatar({ account, size }: { account: { id?: string; fullName?: string; name?: string; profile_photo_path?: string } | null; size: number }) {
  useColorTheme();
  const path = account?.profile_photo_path;
  const photoKey = `${account?.id || ''}:${path || ''}`;
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photo = useQuery({
    queryKey: ['driver-profile-photo-source', account?.id, path],
    queryFn: () => authenticatedFileSource(path),
    enabled: !!account?.id && !!path,
  });
  const initials = (account?.fullName || account?.name || 'Sjåfør').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  return <View style={{ width: size, height: size, borderRadius: size * .34, overflow: 'hidden', backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }}>
    {account?.id && path && photo.data && failedPhoto !== photoKey ? <Image source={photo.data} contentFit="cover" onError={() => setFailedPhoto(photoKey)} style={{ width: size, height: size }} accessibilityLabel="Ditt profilbilde" /> : <Text style={{ fontSize: size * .36, fontFamily: font.semibold }}>{initials}</Text>}
  </View>;
}
