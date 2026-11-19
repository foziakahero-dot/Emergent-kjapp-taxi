import { DriverVehicleMarker } from './DriverVehicleMarker';
import { DriverMapControls } from './DriverMapControls';
import type { DemandCell } from '@/src/lib/demand';
import { MapCar, PositionDot } from '@/src/components/MapMarkers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
  StyleImport,
} from '@rnmapbox/maps';
import Svg, { Circle, Rect } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';
import { useSmoothPosition } from './useSmoothPosition';
import { InteractiveMap as RasterInteractiveMap } from './InteractiveMap';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number; speed?: number | null };

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
  demand?: DemandCell[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  controlsTop?: number;
  overlayBottom?: number;
  interactive?: boolean;
  navigationFollow?: boolean;
};

function PointMarker({ kind }: { kind: 'pickup' | 'dropoff' | 'user' }) {
  useColorTheme();
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
  demand = [],
  activeCar,
  user,
  style,
  testID,
  controlsTop = 116,
  overlayBottom = 170,
  interactive = true,
  navigationFollow = false,
}: Props) {
  const theme = useColorTheme();
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const [mapBearing, setMapBearing] = useState(0);
  const [manual, setManual] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const smoothCar = useSmoothPosition(activeCar);
  useEffect(() => { setManual(false); }, [navigationFollow]);

  const focus = useMemo(() => {
    const points: LL[] = [];
    if (user) points.push(user);
    if (pickup) points.push(pickup);
    if (dropoff) points.push(dropoff);
    if (activeCar) points.push({ lat: activeCar.lat, lng: activeCar.lng });
    points.push(...demand);
    return points;
  }, [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, demand]);

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
    camera.fitBounds?.(ne, sw, [controlsTop, 58, overlayBottom, 58], duration);
  }, [focusKey, controlsTop, overlayBottom]);

  useEffect(() => {
    if (navigationFollow && activeCar && mapReady && !manual) {
      cameraRef.current?.setCamera({ centerCoordinate: [activeCar.lng, activeCar.lat],
        zoomLevel: 16.5, pitch: 45, heading: activeCar.heading || 0,
        animationDuration: 900, animationMode: 'easeTo' });
      return;
    }
    if (!mapReady || manual) return;
    fitFocus(350);
  }, [mapReady, manual, fitFocus, navigationFollow, activeCar?.lat, activeCar?.lng, activeCar?.heading]);

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
        demand={demand}
        activeCar={activeCar}
        user={user}
        style={style}
        testID={testID}
        controlsTop={controlsTop}
        overlayBottom={overlayBottom}
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
        logoPosition={{ left: 10, bottom: overlayBottom + 10 }}
        attributionPosition={{ left: 98, bottom: overlayBottom + 10 }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onCameraChanged={(state: any) => {
          const heading = state?.properties?.heading;
          if (Number.isFinite(heading)) setMapBearing(Math.round(heading));
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
            lightPreset: theme.effective === 'dark' ? 'dusk' : 'day',
            theme: 'default',
            show3dObjects: true,
            show3dBuildings: true,
            show3dLandmarks: false,
            show3dTrees: false,
            showPlaceLabels: true,
            showPointOfInterestLabels: false,
            showRoadLabels: true,
            showPedestrianRoads: true,
            showHdRoads: true,
          } as any}
        />

        {demand.length ? <ShapeSource id="snar-demand" shape={{ type: 'FeatureCollection', features: demand.map((cell, index) => ({ type: 'Feature', id: index, properties: { weight: cell.weight }, geometry: { type: 'Point', coordinates: [cell.lng, cell.lat] } })) }}>
          <CircleLayer id="snar-demand-cells" slot="top" style={{ circleColor: colors.accent, circleRadius: ['interpolate', ['linear'], ['get', 'weight'], 0, 12, 1, 42], circleOpacity: .35, circleBlur: .7 }} />
        </ShapeSource> : null}

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
            <MapCar heading={(car.heading || 0) - mapBearing} />
          </MarkerView>
        ))}

        {smoothCar ? (
          <MarkerView coordinate={[smoothCar.lng, smoothCar.lat]} allowOverlap>
            <DriverVehicleMarker heading={smoothCar.heading - mapBearing} speed={activeCar?.speed} />
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

      {interactive ? <DriverMapControls top={controlsTop} onZoomIn={() => void zoomBy(1)} onZoomOut={() => void zoomBy(-1)} onRecenter={recenter} /> : null}
    </View>
  );
}

export const Map = MapboxInteractiveMap;
export const InteractiveMap = MapboxInteractiveMap;
export default MapboxInteractiveMap;

