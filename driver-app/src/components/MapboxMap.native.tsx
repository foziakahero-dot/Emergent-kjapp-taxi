import { MapCar, PositionDot } from '@/src/components/MapMarkers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
  StyleImport,
} from '@rnmapbox/maps';
import Svg, { Circle, Rect } from 'react-native-svg';
import { colors } from '@/src/theme';
import { Icon } from './Icon';
import { useSmoothPosition } from './useSmoothPosition';
import { InteractiveMap as RasterInteractiveMap } from './InteractiveMap';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const OSLO: LL = { lat: 59.9139, lng: 10.7522 };
const TOKEN = (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim();
const STYLE_URL = 'mapbox://styles/mapbox/standard';

if (TOKEN) {
  Mapbox.setAccessToken(TOKEN);
}

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

function MarkerCar({ car }: { car: Car; active?: boolean }) {
  return <MapCar heading={car.heading || 0} />;
}

function PointMarker({ kind }: { kind: 'pickup' | 'dropoff' | 'user' }) {
  if (kind === 'dropoff') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Rect x={8} y={8} width={16} height={16} rx={4} fill={colors.bg} stroke={colors.route} strokeWidth={3} />
        <Rect x={13} y={13} width={6} height={6} fill={colors.text} />
      </Svg>
    );
  }
  if (kind === 'user') return <PositionDot />;
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={12} fill={colors.accentSoft} />
      <Circle cx={16} cy={16} r={7} fill={colors.accent} />
      <Circle cx={16} cy={16} r={2.5} fill={colors.accentOn} />
    </Svg>
  );
}

export function MapboxInteractiveMap({
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
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const [manual, setManual] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const smoothCar = useSmoothPosition(activeCar);

  const focus = useMemo(() => {
    const points: LL[] = [];
    if (user) points.push(user);
    if (pickup) points.push(pickup);
    if (dropoff) points.push(dropoff);
    if (activeCar) points.push({ lat: activeCar.lat, lng: activeCar.lng });
    return points;
  }, [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng]);

  const focusKey = focus.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  const fitFocus = useCallback((duration = 450) => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (!focus.length) {
      camera.setCamera?.({
        centerCoordinate: [OSLO.lng, OSLO.lat],
        zoomLevel: 13.4,
        pitch: 0,
        animationDuration: duration,
        animationMode: 'easeTo',
      });
      return;
    }
    if (focus.length === 1) {
      camera.setCamera?.({
        centerCoordinate: [focus[0].lng, focus[0].lat],
        zoomLevel: 13.4,
        pitch: 0,
        animationDuration: duration,
        animationMode: 'easeTo',
      });
      return;
    }
    const lngs = focus.map((p) => p.lng);
    const lats = focus.map((p) => p.lat);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    camera.fitBounds?.(ne, sw, [90, 58, 170, 58], duration);
  }, [focusKey]);

  useEffect(() => {
    if (!mapReady || manual) return;
    fitFocus(350);
  }, [mapReady, manual, fitFocus]);

  const routeShape = useMemo(() => {
    const coordinates =
      route && route.length > 1
        ? route
        : pickup && dropoff
          ? [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]]
          : [];
    if (coordinates.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    } as any;
  }, [route, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  if (!TOKEN) {
    return (
      <RasterInteractiveMap
        pickup={pickup}
        dropoff={dropoff}
        route={route}
        cars={cars}
        activeCar={activeCar}
        user={user}
        style={style}
        testID={testID}
        interactive={interactive}
      />
    );
  }

  const zoomBy = async (delta: number) => {
    const current = Number(await mapRef.current?.getZoom?.());
    const next = Math.max(3, Math.min(20, (Number.isFinite(current) ? current : 15) + delta));
    setManual(true);
    cameraRef.current?.zoomTo?.(next, 180);
  };

  const recenter = () => {
    setManual(false);
    fitFocus(350);
  };

  return (
    <View testID={testID} style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        styleURL={STYLE_URL}
        projection="mercator"
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        compassEnabled={false}
        scaleBarEnabled={false}
        attributionEnabled
        logoEnabled
        onDidFinishLoadingMap={() => setMapReady(true)}
        onCameraChanged={(state: any) => {
          if (state?.gestures?.isGestureActive) setManual(true);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [user?.lng ?? OSLO.lng, user?.lat ?? OSLO.lat],
            zoomLevel: 13.4,
            pitch: 0,
          }}
          minZoomLevel={3}
          maxZoomLevel={20}
        />

        <StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: 'day',
            theme: 'monochrome',
            show3dObjects: false,
            show3dBuildings: false,
            show3dLandmarks: false,
            show3dTrees: false,
            showPlaceLabels: true,
            showPointOfInterestLabels: false,
            showRoadLabels: true,
            showPedestrianRoads: true,
            showHdRoads: true,
          } as any}
        />

        {routeShape ? (
          <ShapeSource id="kjapp-route-source" shape={routeShape}>
            <LineLayer
              id="kjapp-route-glow"
              slot="top"
              style={{
                lineColor: colors.route,
                lineWidth: 12,
                lineOpacity: 0.22,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <LineLayer
              id="kjapp-route-line"
              slot="top"
              style={{
                lineColor: colors.route,
                lineWidth: 5,
                lineOpacity: 0.98,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}

        {cars.map((car, index) => (
          <MarkerView key={`car-${index}`} coordinate={[car.lng, car.lat]} allowOverlap>
            <MarkerCar car={car} />
          </MarkerView>
        ))}

        {smoothCar ? (
          <MarkerView coordinate={[smoothCar.lng, smoothCar.lat]} allowOverlap>
            <MarkerCar car={smoothCar} active />
          </MarkerView>
        ) : null}

        {pickup ? (
          <MarkerView coordinate={[pickup.lng, pickup.lat]} allowOverlap>
            <PointMarker kind="pickup" />
          </MarkerView>
        ) : null}

        {dropoff ? (
          <MarkerView coordinate={[dropoff.lng, dropoff.lat]} allowOverlap>
            <PointMarker kind="dropoff" />
          </MarkerView>
        ) : null}

        {user ? (
          <MarkerView coordinate={[user.lng, user.lat]} allowOverlap>
            <PointMarker kind="user" />
          </MarkerView>
        ) : null}
      </MapView>

      {interactive ? (
        <View style={{ position: 'absolute', right: 14, top: 116, gap: 8 }} pointerEvents="box-none">
          <Ctrl name="plus" onPress={() => void zoomBy(1)} testID="map-zoom-in" />
          <Ctrl name="minus" onPress={() => void zoomBy(-1)} testID="map-zoom-out" />
          <Ctrl name="crosshair" onPress={recenter} testID="map-recenter" />
        </View>
      ) : null}
    </View>
  );
}

function Ctrl({ name, onPress, testID }: { name: any; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Icon name={name} size={20} color={colors.text} />
    </Pressable>
  );
}

export const Map = MapboxInteractiveMap;
export const InteractiveMap = MapboxInteractiveMap;
export default MapboxInteractiveMap;

