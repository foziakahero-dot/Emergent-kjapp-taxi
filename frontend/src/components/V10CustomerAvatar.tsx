import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { customerProfileApi } from '@/src/lib/api';
import { colors, font, useColorTheme } from '@/src/theme';
import { Text } from './Typography';

export function V10CustomerAvatar({ initials, version }: { initials: string; version?: string }) {
  useColorTheme();
  const [photo, setPhoto] = useState<{ version: string; source: any } | null>(null);
  useEffect(() => {
    let current = true;
    setPhoto(null);
    if (version) void customerProfileApi.photoSource(version).then(source => { if (current) setPhoto({ version, source }); }).catch(() => {});
    return () => { current = false; };
  }, [version]);
  const style = { width: 32, height: 32, borderRadius: 10.88 };
  return photo && photo.version === version ? <Image source={photo.source} style={style} onError={() => setPhoto(current => current?.version === version ? null : current)} /> : <View style={[style, { backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.text, fontFamily: font.semibold, fontSize: 11.52 }}>{initials}</Text></View>;
}
