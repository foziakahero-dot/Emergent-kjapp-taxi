import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { colors, useColorTheme } from '@/src/theme';
import { carsApi } from '@/src/lib/api';
import { Icon } from './Icon';
import { CarSvg, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { useSmoothPosition } from './useSmoothPosition';
import { InteractiveMap as RasterFallback } from './InteractiveMapFallback';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const OSLO = { lat: 59.9127, lng: 10.7461 };
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const MAPBOX_TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim();

if (MAPBOX_TOKEN) {
  MapboxGL.setAccessToken(MAPBOX_TOKEN);
}

const toCoord = (p: LL): [number, number] => [p.lng, p.lat];

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const samePoint = (a?: LL | null, b?: LL | null) =>
  !!a && !!b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

function MarkerDot({ kind }: { kind: 'pickup' | 'dropoff' }) {
  useColorTheme();
  if (kind === 'pickup') {
    return (
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: colors.accentSoft,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: 11, height: 11, borderRadius: 6,
          backgroundColor: colors.accent,
          borderWidth: 2, borderColor: colors.accentOn,
        }} />
      </View>
    );
  }

  return (
    <View style={{
      width: 20, height: 20, borderRadius: 5,
      backgroundColor: colors.bg,
      borderWidth: 3, borderColor: colors.accent,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ width: 6, height: 6, backgroundColor: colors.text }} />
    </View>
  );
}

function CarMarker({ car, active = false }: { car: Car; active?: boolean }) {
  useColorTheme();
  return (
    <View style={{
      width: active ? 56 : 42,
      height: active ? 56 : 42,
      borderRadius: active ? 28 : 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: active ? colors.accentGlow : 'rgba(255,255,255,0.74)',
      transform: [{ rotate: String(car.heading || 0) + 'deg' }],
    }}>
      <CarSvg size={active ? 40 : 30} {...(active ? CAR_ACTIVE : CAR_IDLE)} />
    </View>
  );
}

export function InteractiveMap({
  pickup,
  dropoff,
  route,
  cars = [],
  activeCar,
  user,
  style,
  testID,
  interactive = true,
}: {
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
  useColorTheme();
  const cameraRef = useRef<any>(null);
  const zoomRef = useRef(15);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [destinationCars, setDestinationCars] = useState<Car[]>([]);
  const smoothCar = useSmoothPosition(activeCar, 1600);

  // Home historically sends cars=[] as soon as a destination is selected.
  // Keep the customer experience truthful by reusing the same real /cars/nearby
  // endpoint only in that pre-booking state. No demo/cache cars are introduced.
  useEffect(() => {
    if (!dropoff || activeCar || !user || cars.length > 0) {
      setDestinationCars([]);
      return;
    }

    let mounted = true;
    const load = () => {
      carsApi.nearby(user.lat, user.lng)
        .then((result) => {
          if (mounted) setDestinationCars(Array.isArray(result?.cars) ? result.cars : []);
        })
        .catch(() => {
          if (mounted) setDestinationCars([]);
        });
    };

    load();
    const timer = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, user?.lat, user?.lng, cars.length]);

  const visibleCars = cars.length > 0 ? cars : destinationCars;

  const focus = useMemo(() => {
    const pts: LL[] = [];
    const hasTripGeometry = Boolean(pickup || dropoff || activeCar);

    if (hasTripGeometry) {
      if (pickup) pts.push(pickup);
      else if (user) pts.push(user);
      if (dropoff && !samePoint(pickup || user, dropoff)) pts.push(dropoff);
      if (activeCar) pts.push({ lat: activeCar.lat, lng: activeCar.lng });
      return pts;
    }

    // Idle customer map: keep customer location only as an invisible anchor,
    // while the visible objects are the nearest real online vehicles.
    if (user) pts.push(user);
    visibleCars.slice(0, 6).forEach((car) => pts.push({ lat: car.lat, lng: car.lng }));
    return pts;
  }, [
    user?.lat, user?.lng,
    pickup?.lat, pickup?.lng,
    dropoff?.lat, dropoff?.lng,
    activeCar?.lat, activeCar?.lng,
    visibleCars,
  ]);

  const fit = useCallback((animated = true) => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (!focus.length) {
      camera.setCamera({
        centerCoordinate: toCoord(OSLO),
        zoomLevel: 12.8,
        pitch: 0,
        heading: 0,
        animationDuration: animated ? 450 : 0,
        animationMode: 'easeTo',
      });
      return;
    }

    if (focus.length === 1) {
      camera.setCamera({
        centerCoordinate: toCoord(focus[0]),
        zoomLevel: activeCar ? 16.6 : 15.8,
        pitch: activeCar ? 44 : 18,
        heading: activeCar?.heading || 0,
        padding: { paddingTop: 90, paddingRight: 60, paddingBottom: 190, paddingLeft: 60 },
        animationDuration: animated ? 500 : 0,
        animationMode: 'easeTo',
      });
      return;
    }

    const lats = focus.map((p) => p.lat);
    const lngs = focus.map((p) => p.lng);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    camera.fitBounds(ne, sw, [110, 70, 220, 70], animated ? 550 : 0);
  }, [focus, activeCar?.heading]);

  const recenterOnUser = useCallback(() => {
    const camera = cameraRef.current;
    setManual(false);
    if (!camera || !user) {
      fit(true);
      return;
    }
    camera.setCamera({
      centerCoordinate: toCoord(user),
      zoomLevel: 15.8,
      pitch: 18,
      heading: 0,
      padding: { paddingTop: 90, paddingRight: 60, paddingBottom: 190, paddingLeft: 60 },
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [fit, user?.lat, user?.lng]);

  useEffect(() => {
    if (ready && !manual) fit(false);
  }, [ready, manual, fit]);

  const routeCoordinates = useMemo(() => {
    if (route?.length) {
      return route
        .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map((p) => [Number(p[0]), Number(p[1])]);
    }
    if (pickup && dropoff) return [toCoord(pickup), toCoord(dropoff)];
    return [];
  }, [route, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  const routeShape = useMemo(() => ({
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: routeCoordinates,
    },
  }), [routeCoordinates]);

  if (!MAPBOX_TOKEN) {
    return (
      <RasterFallback
        pickup={pickup}
        dropoff={dropoff}
        route={route}
        cars={visibleCars}
        activeCar={activeCar}
        user={null}
        style={style}
        testID={testID}
        interactive={interactive}
      />
    );
  }

  return (
    <View testID={testID} style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}>
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/standard"
        projection="mercator"
        zoomEnabled={interactive}
        scrollEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
        compassEnabled={interactive}
        logoEnabled
        attributionEnabled
        scaleBarEnabled={false}
        onDidFinishLoadingStyle={() => {
          setReady(true);
          setManual(false);
        }}
        onRegionWillChange={(feature: any) => {
          if (feature?.properties?.isUserInteraction) setManual(true);
        }}
        onCameraChanged={(state: any) => {
          const z = Number(state?.properties?.zoom);
          if (Number.isFinite(z)) zoomRef.current = z;
          if (state?.gestures?.isGestureActive) setManual(true);
        }}
        gestureSettings={{
          pinchPanEnabled: interactive,
          pinchZoomEnabled: interactive,
          pitchEnabled: interactive,
          quickZoomEnabled: interactive,
          rotateEnabled: interactive,
          panEnabled: interactive,
          simultaneousRotateAndPinchZoomEnabled: interactive,
        }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          minZoomLevel={MIN_ZOOM}
          maxZoomLevel={MAX_ZOOM}
          defaultSettings={{
            centerCoordinate: toCoord(user || OSLO),
            zoomLevel: user ? 15.8 : 12.8,
            pitch: 0,
            heading: 0,
          }}
        />

        <MapboxGL.StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: 'day',
            theme: 'default',
            showHdRoads: true,
            show3dObjects: true,
            show3dBuildings: true,
            show3dTrees: true,
            show3dLandmarks: true,
            show3dFacades: true,
            showRoadLabels: true,
            showPlaceLabels: true,
            showPointOfInterestLabels: true,
            showTransitLabels: true,
            showPedestrianRoads: true,
          }}
        />

        {routeCoordinates.length >= 2 ? (
          <MapboxGL.ShapeSource id="kjapp-route-source" shape={routeShape as any}>
            <MapboxGL.LineLayer
              id="kjapp-route-casing"
              slot="top"
              style={{
                lineColor: colors.accent,
                lineOpacity: 0.24,
                lineWidth: 11,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <MapboxGL.LineLayer
              id="kjapp-route-line"
              slot="top"
              style={{
                lineColor: colors.accent,
                lineOpacity: 0.96,
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {visibleCars.slice(0, 80).map((car, index) => (
          <MapboxGL.MarkerView
            key={'nearby-' + index}
            coordinate={[car.lng, car.lat]}
            allowOverlap
            allowOverlapWithPuck
          >
            <CarMarker car={car} />
          </MapboxGL.MarkerView>
        ))}

        {smoothCar ? (
          <MapboxGL.MarkerView
            coordinate={[smoothCar.lng, smoothCar.lat]}
            allowOverlap
            allowOverlapWithPuck
          >
            <CarMarker car={smoothCar} active />
          </MapboxGL.MarkerView>
        ) : null}

        {pickup ? (
          <MapboxGL.MarkerView coordinate={toCoord(pickup)} allowOverlap>
            <MarkerDot kind="pickup" />
          </MapboxGL.MarkerView>
        ) : null}

        {dropoff ? (
          <MapboxGL.MarkerView coordinate={toCoord(dropoff)} allowOverlap>
            <MarkerDot kind="dropoff" />
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>

      {interactive ? (
        <View style={{ position: 'absolute', right: 14, top: 116, gap: 8 }} pointerEvents="box-none">
          <Ctrl
            name="plus"
            testID="map-zoom-in"
            onPress={() => {
              setManual(true);
              const next = clamp(zoomRef.current + 1, MIN_ZOOM, MAX_ZOOM);
              zoomRef.current = next;
              cameraRef.current?.zoomTo(next, 220);
            }}
          />
          <Ctrl
            name="minus"
            testID="map-zoom-out"
            onPress={() => {
              setManual(true);
              const next = clamp(zoomRef.current - 1, MIN_ZOOM, MAX_ZOOM);
              zoomRef.current = next;
              cameraRef.current?.zoomTo(next, 220);
            }}
          />
          <Ctrl
            name="crosshair"
            testID="map-recenter"
            onPress={recenterOnUser}
          />
        </View>
      ) : null}
    </View>
  );
}

function Ctrl({ name, onPress, testID }: { name: any; onPress: () => void; testID: string }) {
  useColorTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(7,11,14,0.90)',
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Icon name={name} size={20} color={colors.text} />
    </Pressable>
  );
}

export const Map = InteractiveMap;
export default InteractiveMap;
