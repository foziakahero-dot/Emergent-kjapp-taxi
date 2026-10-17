import { Avatar } from './snar10/Avatar';
import React, { useEffect, useState } from 'react';
import { customerProfileApi } from '@/src/lib/api';
import { useColorTheme } from '@/src/theme';

export function V10CustomerAvatar({ initials, version }: { initials: string; version?: string }) {
  useColorTheme();
  const [photo, setPhoto] = useState<{ version: string; source: any } | null>(null);
  useEffect(() => {
    let current = true;
    setPhoto(null);
    if (version) void customerProfileApi.photoSource(version).then(source => { if (current) setPhoto({ version, source }); }).catch(() => {});
    return () => { current = false; };
  }, [version]);
  return <Avatar name={initials} initials={initials} size={32}
    src={photo && photo.version === version ? photo.source : null}
    onError={() => setPhoto(current => current?.version === version ? null : current)} />;
}
