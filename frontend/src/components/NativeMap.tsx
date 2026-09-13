import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '@/src/theme';
import { Icon } from './Icon';
import { CarSvg, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const OSLO = { latitude: 59.9127, longitude: 10.7461 };

const GOOGLE_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1115' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9da8af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1115' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#273139' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#11191f' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7d898f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1b242b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#10171c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#c4cbd0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#303b43' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#172027' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#061017' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#60727d' }] },
];

export function NativeMap({ pickup, dropoff, route, cars = [], activeCar, user, style, testID, interactive = true }: {
  pickup?: LL | null;
  dropoff?: LL | null;
  route?: number[][] | null;
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  interactive?: boolean;
}) {
  const mapRef = useRef<MapView | null>(null);
  const [ready, setReady] = useState(false);
  const smoothCar = useSmoothPosition(activeCar);

  const routeCoords = useMemo(() => (route || []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })), [route]);
  const focus = useMemo(() => {
    const out: { latitude: number; longitude: number }[] = [];
    if (user) out.push({ latitude: user.lat, longitude: user.lng });
    if (pickup) out.push({ latitude: pickup.lat, longitude: pickup.lng });
    if (dropoff) out.push({ latitude: dropoff.lat, longitude: dropoff.lng });
    if (activeCar) out.push({ latitude: activeCar.lat, longitude: activeCar.lng });
    return out;
  }, [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng]);
  const focusKey = focus.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|');

  const recenter = useCallback(() => {
    if (!mapRef.current) return;
    if (focus.length > 1) {
      mapRef.current.fitToCoordinates(focus, { edgePadding: { top: 150, right: 55, bottom: 300, left: 55 }, animated: true });
    } else {
      const c = focus[0] || OSLO;
      mapRef.current.animateCamera({ center: c, zoom: 16 }, { duration: 380 });
    }
  }, [focusKey]);

  useEffect(() => { if (ready) recenter(); }, [ready, focusKey, recenter]);

  const zoom = async (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const camera = await map.getCamera();
      map.animateCamera({ ...camera, zoom: Math.max(3, Math.min(20, (camera.zoom || 15) + delta)) }, { duration: 220 });
    } catch {}
  };

  return (
    <View testID={testID} style={[{ overflow: 'hidden', backgroundColor: colors.mapCanvas }, style]}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...OSLO, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
        customMapStyle={Platform.OS === 'android' ? GOOGLE_DARK_STYLE : undefined}
        userInterfaceStyle="dark"
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        showsPointsOfInterest
        showsBuildings
        loadingEnabled
        loadingBackgroundColor={colors.mapCanvas}
        loadingIndicatorColor={colors.accent}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onMapReady={() => setReady(true)}
      >
        {routeCoords.length > 1 ? <Polyline coordinates={routeCoords} strokeColor={colors.accent} strokeWidth={5} /> : null}

        {user ? (
          <Marker coordinate={{ latitude: user.lat, longitude: user.lng }} anchor={{ x: 0.5, y: 0.5 }} title="Du er her">
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(64,145,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#4091FF', borderWidth: 2, borderColor: '#fff' }} />
            </View>
          </Marker>
        ) : null}

        {pickup ? (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, borderWidth: 4, borderColor: 'rgba(203,163,101,0.25)' }} />
          </Marker>
        ) : null}

        {dropoff ? (
          <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.bg }} />
          </Marker>
        ) : null}

        {cars.map((car, i) => (
          <Marker key={`car-${i}`} coordinate={{ latitude: car.lat, longitude: car.lng }} rotation={car.heading || 0} anchor={{ x: 0.5, y: 0.5 }} flat tracksViewChanges={false}>
            <CarSvg size={27} {...CAR_IDLE} />
          </Marker>
        ))}

        {smoothCar ? (
          <Marker coordinate={{ latitude: smoothCar.lat, longitude: smoothCar.lng }} rotation={smoothCar.heading || 0} anchor={{ x: 0.5, y: 0.5 }} flat>
            <CarSvg size={38} {...CAR_ACTIVE} />
          </Marker>
        ) : null}
      </MapView>

      {interactive ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 14, top: 116, gap: 8 }}>
          <Ctrl name="plus" onPress={() => zoom(1)} testID="map-zoom-in" />
          <Ctrl name="minus" onPress={() => zoom(-1)} testID="map-zoom-out" />
          <Ctrl name="crosshair" onPress={recenter} testID="map-recenter" />
        </View>
      ) : null}
    </View>
  );
}

function Ctrl({ name, onPress, testID }: { name: any; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,18,22,0.94)', borderWidth: 1, borderColor: colors.line }}>
      <Icon name={name} size={20} color={colors.text} />
    </Pressable>
  );
}
