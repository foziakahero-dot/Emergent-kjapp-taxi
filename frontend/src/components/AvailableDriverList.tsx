import { carEtaLabel } from './CarEtaBadge';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/src/components/Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { useAuth } from '@/src/context/AuthContext';
import { nearbyDriverMediaSource } from '@/src/lib/api';
import { MapCarData } from '@/src/lib/liveCars';

type Point = { lat: number; lng: number };
function DriverImage({ car, point, kind }: { car: MapCarData; point: Point; kind: 'profile' | 'car-icon' }) {
  const { user } = useAuth();
  const version = kind === 'profile' ? car.photo_version : car.car_icon_version;
  const [source, setSource] = useState<any>(null);
  useEffect(() => {
    let active = true; setSource(null);
    if (version && car.id) void nearbyDriverMediaSource(car.id, kind, point, version).then(value => { if (active) setSource(value); }).catch(() => {});
    return () => { active = false; };
    // Freeze this fetch's circle. A new media version or customer gets a fresh
    // authenticated source; marker removal unmounts the private image too.
  }, [user?.id, car.id, version, kind]);
  const size = kind === 'profile' ? { width: 44, height: 44, borderRadius: 22 } : { width: 64, height: 40, borderRadius: 8 };
  return source ? <Image testID={`${kind}-${car.id}`} source={source} style={size} resizeMode={kind === 'profile' ? 'cover' : 'contain'} onError={() => setSource(null)} accessibilityLabel={kind === 'profile' ? `Profilbilde av ${car.name || 'sjåfør'}` : `Bilen til ${car.name || 'sjåfør'}`} />
    : kind === 'profile' ? <View style={[size, { backgroundColor: colors.cardSubtle, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.textSecondary }}>{(car.name || 'S').slice(0, 1)}</Text></View> : null;
}
export function AvailableDriverList({ cars, point }: { cars: MapCarData[]; point?: Point | null }) {
  useColorTheme();
  return <View testID="available-driver-list" style={{ paddingVertical: 12, gap: 8 }}>
    <Text style={{ color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 }}>Tilgjengelige sjåfører innen 5 km</Text>
    {!cars.length ? <Text testID="selected-category-empty" style={{ color: colors.textMuted, fontSize: 12 }}>Ingen ledige sjåfører i denne kategorien akkurat nå.</Text> : cars.map(car => <View key={car.id} testID={`available-driver-${car.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.cardSubtle }}>
      {point ? <DriverImage car={car} point={point} kind="profile" /> : null}
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.text, fontFamily: font.medium, fontSize: 13 }}>{car.name || 'Sjåfør'}</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{car.car || 'Bilmodell ikke oppgitt'} · {carEtaLabel(car)}</Text>
        {typeof car.rating === 'number' && Number.isFinite(car.rating) ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{car.rating.toFixed(1)} av 5</Text> : null}
      </View>
      {point && car.car_icon_version ? <DriverImage car={car} point={point} kind="car-icon" /> : null}
    </View>)}
  </View>;
}
