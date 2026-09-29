import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, Region, UrlTile } from 'react-native-maps';
import { colors } from '@/src/theme';
import { CarSvg, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { Icon } from './Icon';
import { InteractiveMap } from './InteractiveMap';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = LL & { heading?: number; id?: string; driver_id?: string };
type Props = {
  pickup?: LL | null;
  dropoff?: LL | null;
  route?: number[][] | null;
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  interactive?: boolean;
};

const OSLO = { latitude: 59.9127, longitude: 10.7461 };
const INITIAL_REGION: Region = { ...OSLO, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || '';
const BASE_TILES = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v4-dark/{z}/{x}/{y}@2x.png?key=${MAPTILER_KEY}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const LABEL_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = MAPTILER_KEY ? '© MapTiler · OpenStreetMap' : '© Esri · OpenStreetMap';
const valid = (point?: LL | null): point is LL =>
  !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
  Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
const coordinate = (point: LL) => ({ latitude: point.lat, longitude: point.lng });

function NativeMap({
  pickup,
  dropoff,
  route,
  cars = [],
  activeCar,
  user,
  style,
  testID,
  interactive = true,
}: Props) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const manual = useRef(false);
  const lastRegion = useRef<Region>(INITIAL_REGION);
  const smoothCar = useSmoothPosition(activeCar);

  // Nearby cars and GPS polling update markers only. They never change the camera.
  const focusKey = [
    valid(user) ? 'located' : '',
    valid(pickup) ? `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}` : '',
    valid(dropoff) ? `${dropoff.lat.toFixed(5)},${dropoff.lng.toFixed(5)}` : '',
    valid(activeCar) ? 'assigned' : '',
  ].join('|');
  const dropoffKey = valid(dropoff) ? `${dropoff.lat.toFixed(5)},${dropoff.lng.toFixed(5)}` : '';
  const lastDropoffKey = useRef(dropoffKey);
  const focus = useCallback(() => {
    const points = [pickup, dropoff].filter(valid);
    if (!points.length && valid(activeCar)) points.push(activeCar);
    if (!points.length && valid(user)) points.push(user);
    if (points.length > 1) {
      map.current?.fitToCoordinates(points.map(coordinate), {
        edgePadding: { top: 145, left: 54, right: 54, bottom: Math.min(250, size.height * 0.32) },
        animated: true,
      });
    } else {
      const center = points.length ? coordinate(points[0]) : OSLO;
      map.current?.animateToRegion({
        ...center,
        latitudeDelta: points.length ? 0.015 : 0.05,
        longitudeDelta: points.length ? 0.015 : 0.05,
      }, 350);
    }
  }, [pickup, dropoff, activeCar, user, size.height]);

  useEffect(() => {
    const newDestination = lastDropoffKey.current !== dropoffKey;
    lastDropoffKey.current = dropoffKey;
    if (!ready || !size.width || !size.height || (manual.current && !newDestination)) return;
    if (newDestination) manual.current = false;
    focus();
    // focusKey deliberately excludes driver position and subsequent GPS changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, size.width, size.height, focusKey, dropoffKey]);

  const routeCoordinates = useMemo(() => {
    const points = route?.length
      ? route.map(([lng, lat]) => ({ lat, lng }))
      : valid(pickup) && valid(dropoff) ? [pickup, dropoff] : [];
    return points.filter(valid).map(coordinate);
  }, [route, pickup, dropoff]);

  const zoom = (factor: number) => {
    manual.current = true;
    const region = lastRegion.current;
    const latitudeDelta = Math.max(0.0006, Math.min(80, region.latitudeDelta * factor));
    const longitudeDelta = Math.max(0.0006, Math.min(80, region.longitudeDelta * factor));
    map.current?.animateToRegion({ ...region, latitudeDelta, longitudeDelta }, 220);
  };

  return (
    <View testID={testID} style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
      }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={valid(user) ? { ...coordinate(user), latitudeDelta: 0.015, longitudeDelta: 0.015 } : INITIAL_REGION}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        onMapReady={() => setReady(true)}
        onTouchStart={() => { manual.current = true; }}
        onRegionChangeComplete={(region) => { lastRegion.current = region; }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        moveOnMarkerPress={false}
        toolbarEnabled={false}
      >
        <UrlTile urlTemplate={BASE_TILES} tileSize={256} zIndex={-2} />
        {!MAPTILER_KEY && <UrlTile urlTemplate={LABEL_TILES} tileSize={256} zIndex={-1} />}
        {routeCoordinates.length > 1 && (
          <Polyline coordinates={routeCoordinates} strokeColor={colors.accent} strokeWidth={5} />
        )}
        {cars.filter((car) => valid(car)).map((car, index) => (
          <Marker
            key={car.id || car.driver_id || `car-${index}`}
            coordinate={coordinate(car)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={Platform.OS === 'android'}
          >
            <View style={{ transform: [{ rotate: `${car.heading || 0}deg` }], opacity: dropoff ? 0.7 : 1 }}>
              <CarSvg size={34} {...CAR_IDLE} />
            </View>
          </Marker>
        ))}
        {smoothCar && valid(smoothCar) && (
          <Marker coordinate={coordinate(smoothCar)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
            <View style={{ transform: [{ rotate: `${smoothCar.heading}deg` }] }}>
              <CarSvg size={42} {...CAR_ACTIVE} />
            </View>
          </Marker>
        )}
        {valid(pickup) && (
          <Marker coordinate={coordinate(pickup)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: colors.accent, borderWidth: 3, borderColor: '#FFFFFF' }} />
          </Marker>
        )}
        {valid(dropoff) && (
          <Marker coordinate={coordinate(dropoff)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.accent }} />
          </Marker>
        )}
        {valid(user) && (
          <Marker coordinate={coordinate(user)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(64,145,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: '#4091FF', borderWidth: 2, borderColor: '#FFFFFF' }} />
            </View>
          </Marker>
        )}
      </MapView>
      <Text pointerEvents="none" style={{ position: 'absolute', bottom: 3, left: 6, color: 'rgba(244,244,240,0.7)', fontSize: 9 }}>
        {ATTRIBUTION}
      </Text>
      {interactive && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 116, right: 14, gap: 8 }}>
          <Control name="plus" testID="map-zoom-in" onPress={() => zoom(0.5)} />
          <Control name="minus" testID="map-zoom-out" onPress={() => zoom(2)} />
          <Control name="crosshair" testID="map-recenter" onPress={() => {
            if (valid(user)) {
              manual.current = true;
              map.current?.animateToRegion({ ...lastRegion.current, ...coordinate(user) }, 350);
            } else {
              manual.current = false;
              focus();
            }
          }} />
        </View>
      )}
    </View>
  );
}

function Control({ name, onPress, testID }: { name: 'plus' | 'minus' | 'crosshair'; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name === 'plus' ? 'Zoom inn' : name === 'minus' ? 'Zoom ut' : 'Sentrer kart'}
      testID={testID}
      hitSlop={8}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(12,18,22,0.94)', borderWidth: 1, borderColor: colors.line }}>
      <Icon name={name} size={20} color={colors.text} />
    </Pressable>
  );
}

/**
 * Standalone Android builds need a real Maps SDK key in the native binary.
 * Keep the existing labeled tile map until that config is present.
 */
export function Map(props: Props) {
  const androidNativeMapsEnabled = Constants.expoConfig?.extra?.androidNativeMapsEnabled === true;
  if (Platform.OS === 'android' && !androidNativeMapsEnabled) {
    return <InteractiveMap {...props} />;
  }
  return <NativeMap {...props} />;
}

export { NativeMap };
export default Map;
