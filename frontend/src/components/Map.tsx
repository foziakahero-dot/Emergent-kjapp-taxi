import React, { useEffect, useRef } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '@/src/theme';
import { CarSvg, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1116' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A96A0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06090A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1B232A' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#12181D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080E12' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#090D10' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1C242C' }] },
];

export function Map({
  pickup,
  dropoff,
  route,
  cars = [],
  activeCar,
  user,
  style,
  testID,
}: {
  pickup?: LL | null;
  dropoff?: LL | null;
  route?: number[][] | null;
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const ref = useRef<MapView>(null);
  const smoothCar = useSmoothPosition(activeCar);

  const coords: { latitude: number; longitude: number }[] = [];
  if (pickup) coords.push({ latitude: pickup.lat, longitude: pickup.lng });
  if (dropoff) coords.push({ latitude: dropoff.lat, longitude: dropoff.lng });
  if (activeCar) coords.push({ latitude: activeCar.lat, longitude: activeCar.lng });
  if (user && !dropoff) coords.push({ latitude: user.lat, longitude: user.lng });

  const fit = () => {
    if (ref.current && coords.length >= 2) {
      ref.current.fitToCoordinates(coords, {
        edgePadding: { top: 90, right: 70, bottom: 320, left: 70 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    const t = setTimeout(fit, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, dropoff?.lat, activeCar?.lat]);

  const center = user || pickup || dropoff || { lat: 59.9127, lng: 10.7461 };
  const line = (route && route.length ? route : (pickup && dropoff ? [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]] : []))
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

  return (
    <View style={style} testID={testID}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        customMapStyle={DARK_STYLE}
        userInterfaceStyle="dark"
        showsUserLocation={!!user && !dropoff}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        onMapReady={fit}
      >
        {line.length >= 2 ? (
          <>
            <Polyline coordinates={line} strokeColor={colors.accentGlow} strokeWidth={10} />
            <Polyline coordinates={line} strokeColor={colors.accent} strokeWidth={4} />
          </>
        ) : null}

        {pickup ? (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }} />
            </View>
          </Marker>
        ) : null}

        {dropoff ? (
          <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.accent }} />
          </Marker>
        ) : null}

        {cars.map((c, i) => (
          <Marker key={`car${i}`} coordinate={{ latitude: c.lat, longitude: c.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={c.heading || 0}>
            <CarSvg size={26} {...CAR_IDLE} />
          </Marker>
        ))}

        {smoothCar ? (
          <Marker coordinate={{ latitude: smoothCar.lat, longitude: smoothCar.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={smoothCar.heading} zIndex={10}>
            <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentGlow, opacity: 0.5 }} />
              <CarSvg size={38} {...CAR_ACTIVE} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

export default Map;
