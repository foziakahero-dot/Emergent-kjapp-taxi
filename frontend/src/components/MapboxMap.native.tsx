import { mapContentInsets, mapFocusPoints, MapContentInsets, MapFocusMode } from '@/src/lib/mapFocus';
import { AvailableDriverMarker, MapCar, PositionDot } from '@/src/components/MapMarkers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
  StyleImport,
} from '@rnmapbox/maps';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';
import { Text } from './Typography';
import { colors, font, useColorTheme } from '@/src/theme';
import { Icon } from './Icon';
import { useSmoothPosition } from './useSmoothPosition';
import { InteractiveMap as RasterInteractiveMap } from './RasterMap';

type LL = { lat: number; lng: number };
type Car = { id?: string; lat: number; lng: number; heading?: number; eta_min?: number };

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
  focusRoute?: number[][] | null;
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  interactive?: boolean;
  showControls?: boolean;
  focusMode?: MapFocusMode;
  focusRevision?: number;
  contentInsets?: Partial<MapContentInsets>;
};

function MarkerCar({ car }: { car: Car }) {
  useColorTheme();
  const smooth = useSmoothPosition(car);
  if (!smooth) return null;
  return <MarkerView coordinate={[smooth.lng, smooth.lat]} allowOverlap anchor={{ x: .5, y: .66 }}>
    <AvailableDriverMarker heading={smooth.heading} eta={car.eta_min} />
  </MarkerView>;
}

function PointMarker({ kind }: { kind: 'pickup' | 'dropoff' | 'user' }) {
  useColorTheme();
  if (kind === 'dropoff') {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Ellipse cx={16} cy={19} rx={10} ry={3.5} fill="#000" opacity={.16} /><Rect x={5.5} y={5.5} width={21} height={21} rx={6.5} fill={colors.surfaceInverse} />
        <Rect x={12.4} y={12.4} width={7.2} height={7.2} rx={1.6} fill={colors.surface} />
      </Svg>
    );
  }
  if (kind === 'user') return <PositionDot />;
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={19} rx={10} ry={3.5} fill="#000" opacity={.16} /><Circle cx={16} cy={16} r={11} fill={colors.surface} stroke={colors.surfaceInverse} strokeWidth={1.2} strokeOpacity={.15} />
      <Circle cx={16} cy={16} r={6.4} fill={colors.accent} />
      <Circle cx={16} cy={16} r={2.4} fill="#fff" />
    </Svg>
  );
}

export function MapboxInteractiveMap({
  pickup,
  dropoff,
  route,
  focusRoute,
  cars = [],
  activeCar,
  user,
  style,
  testID,
  interactive = true,
  showControls = true,
  focusMode = 'route',
  focusRevision = 0,
  contentInsets,
}: Props) {
  useColorTheme();
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const [manual, setManual] = useState(false);
  useEffect(() => { setManual(false); }, [focusRevision]);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const smoothCar = useSmoothPosition(activeCar, 900);

  const focus = useMemo(() => mapFocusPoints({ user, pickup, dropoff, activeCar, cars, focusMode, focusRoute }),
    [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, cars, focusMode, focusRoute]);

  const focusKey = focus.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  const padding = mapContentInsets(size.width, size.height, contentInsets);
  const paddingKey = `${padding.top},${padding.right},${padding.bottom},${padding.left}`;
  const cameraPadding = { paddingTop: padding.top, paddingRight: padding.right, paddingBottom: padding.bottom, paddingLeft: padding.left };

  const fitFocus = useCallback((duration = 450) => {
    const camera = cameraRef.current;
    if (!camera || !size.width || !size.height) return;
    if (!focus.length) {
      camera.setCamera?.({
        centerCoordinate: [OSLO.lng, OSLO.lat],
        zoomLevel: activeCar ? 16.5 : 15.8,
        padding: cameraPadding,
        pitch: activeCar ? 40 : 25,
        animationDuration: duration,
        animationMode: 'easeTo',
      });
      return;
    }
    if (focus.length === 1) {
      camera.setCamera?.({
        centerCoordinate: [focus[0].lng, focus[0].lat],
        zoomLevel: activeCar ? 16.5 : 15.8,
        padding: cameraPadding,
        pitch: activeCar ? 40 : 25,
        animationDuration: duration,
        animationMode: 'easeTo',
      });
      return;
    }
    const lngs = focus.map((p) => p.lng);
    const lats = focus.map((p) => p.lat);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    camera.fitBounds?.(ne, sw, [padding.top, padding.right, padding.bottom, padding.left], duration);
  }, [focusKey, paddingKey, size.width, size.height, Boolean(activeCar)]);

  useEffect(() => {
    if (!mapReady || manual) return;
    fitFocus(350);
  }, [mapReady, manual, fitFocus]);

  const routeShape = useMemo(() => {
    const coordinates = route?.filter(p => p.length >= 2 && p.every(Number.isFinite)) || [];
    if (coordinates.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    } as any;
  }, [route, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  if (!TOKEN || mapError) {
    return (
      <View style={[{ overflow: 'hidden' }, style]}>
      <RasterInteractiveMap
        pickup={pickup}
        dropoff={dropoff}
        route={route}
        focusRoute={focusRoute}
        cars={cars}
        activeCar={activeCar}
        user={user}
        style={{ flex: 1 }}
        testID={testID}
        interactive={interactive}
        showControls={showControls}
        focusMode={focusMode}
        focusRevision={focusRevision}
        contentInsets={contentInsets}
      />
      <View testID="map-error" style={{ position: 'absolute', left: 16, right: 16, top: 62, backgroundColor: colors.surface, padding: 10, borderRadius: 16 }}>
        <Text accessibilityRole="alert">{TOKEN ? 'Mapbox er midlertidig utilgjengelig. Viser reservekart.' : 'Viser reservekart. Mapbox mangler konfigurasjon.'}</Text>
        {TOKEN ? <Pressable testID="map-retry" onPress={() => { setMapError(false); setMapReady(false); }}><Text>Prøv igjen</Text></Pressable> : null}
      </View>
      </View>
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
    <View testID={testID} onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}>
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
        onMapLoadingError={() => setMapError(true)}
        onCameraChanged={(state: any) => {
          if (state?.gestures?.isGestureActive) setManual(true);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [user?.lng ?? OSLO.lng, user?.lat ?? OSLO.lat],
            zoomLevel: user ? 15.8 : 13.4,
            pitch: user ? 25 : 0,
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
            show3dObjects: true,
            show3dBuildings: true,
            show3dLandmarks: true,
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
                lineColor: colors.surface,
                lineWidth: 7,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <LineLayer
              id="kjapp-route-line"
              slot="top"
              style={{
                lineColor: colors.route,
                lineWidth: 4,
                lineOpacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}

        {cars.map((car, index) => (
          <MarkerCar key={car.id || `car-${index}`} car={car} />
        ))}

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

        {user && (!pickup || Math.abs(user.lat - pickup.lat) > 1e-6 || Math.abs(user.lng - pickup.lng) > 1e-6) ? (
          <MarkerView coordinate={[user.lng, user.lat]} allowOverlap>
            <PointMarker kind="user" />
          </MarkerView>
        ) : null}
        {smoothCar ? (
          <MarkerView coordinate={[smoothCar.lng, smoothCar.lat]} allowOverlap anchor={{ x: .5, y: activeCar?.eta_min != null ? 52 / 77 : .5 }}>
            {activeCar?.eta_min != null ? <View style={{ height: 77, minWidth: 50, alignItems: 'center' }}><Text style={{ height: 24, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.surfaceInverse, color: colors.onInverse, fontFamily: font.semibold, fontSize: 12.5, lineHeight: 24 }}>{activeCar.eta_min} min</Text><View style={{ position: 'absolute', top: 27 }}><MapCar heading={smoothCar.heading} active /></View></View> : <MapCar heading={smoothCar.heading} active />}
          </MarkerView>
        ) : null}

      </MapView>

      {!mapReady ? <View testID="map-loading" pointerEvents="none" style={{ position: 'absolute', left: 16, top: 66, backgroundColor: colors.surface, padding: 12, borderRadius: 16 }}><ActivityIndicator color={colors.accent} /></View> : null}
      {interactive && showControls ? (
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
  useColorTheme();
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


