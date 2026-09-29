import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { runtimeConfigApi } from '@/src/lib/api';
import { colors, font } from '@/src/theme';

type RuntimePayload = {
  shared?: { help_url?: string; status_message?: string };
  config?: {
    maintenance_mode?: boolean;
    maintenance_message?: string;
    force_update?: boolean;
    min_supported_version?: string;
  };
};

function parseVersion(value?: string | null) {
  return String(value || '').split(/[.+-]/).slice(0, 3)
    .map((x) => Number.parseInt(x, 10))
    .map((x) => Number.isFinite(x) ? x : 0);
}

function isOlder(current?: string | null, minimum?: string | null) {
  if (!minimum) return false;
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

export default function RuntimeGuard({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<RuntimePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setPayload(await runtimeConfigApi.get('driver'));
    } catch {
      // Fail open. Driver auth, approval, GPS and trip state are still enforced by backend.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const appVersion = Constants.expoConfig?.version || null;
  const blockedForVersion = useMemo(
    () => Boolean(payload?.config?.force_update && isOlder(appVersion, payload?.config?.min_supported_version)),
    [appVersion, payload?.config?.force_update, payload?.config?.min_supported_version],
  );
  const maintenance = payload?.config?.maintenance_mode === true;

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.driverBg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.online} />
    </View>;
  }

  if (!maintenance && !blockedForVersion) return <>{children}</>;

  const title = blockedForVersion ? 'KJAPP Driver må oppdateres' : 'KJAPP Driver er midlertidig utilgjengelig';
  const message = blockedForVersion
    ? `Denne versjonen (${appVersion || 'ukjent'}) støttes ikke lenger. Oppdater KJAPP Driver før du går på skift.`
    : (payload?.config?.maintenance_message || 'Vi gjør en kort teknisk oppdatering. Ikke gå online før tjenesten er tilbake.');
  const helpUrl = payload?.shared?.help_url || 'https://kjappapp.no/help';

  return (
    <View style={{ flex: 1, backgroundColor: colors.driverBg, padding: 28, alignItems: 'center', justifyContent: 'center' }} testID="driver-runtime-guard">
      <Text style={{ color: colors.text, fontFamily: font.display, fontSize: 28, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 14 }}>{message}</Text>
      {blockedForVersion && payload?.config?.min_supported_version ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 10 }}>
          Minimum støttet versjon: {payload.config.min_supported_version}
        </Text>
      ) : null}
      <Pressable onPress={() => void refresh()} style={{ marginTop: 24, minHeight: 48, paddingHorizontal: 24, borderRadius: 24, backgroundColor: colors.online, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#03120B', fontWeight: '800' }}>Prøv igjen</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(helpUrl).catch(() => {})} style={{ marginTop: 14, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>KJAPP hjelp</Text>
      </Pressable>
    </View>
  );
}
