import { fitMapView, mapFocusPoints, MapContentInsets, MapFocusMode } from '@/src/lib/mapFocus';
import { Text } from '@/src/components/Typography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';
import { Icon } from './Icon';
import { V10VehicleBody, V10RasterCar } from './V10VehicleMarker';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 18;
const OSLO = { lat: 59.9127, lng: 10.7461 };
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || '';
const ATTRIB = MAPTILER_KEY ? '© MapTiler · OpenStreetMap' : '© Esri · OpenStreetMap';

const baseTileUrl = (z: number, x: number, y: number) =>
  MAPTILER_KEY
    ? `https://api.maptiler.com/maps/streets-v4/${z}/${x}/${y}@2x.png?key=${MAPTILER_KEY}`
    : `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;

const labelTileUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/${z}/${y}/${x}`;

function projectX(lng: number, z: number) {
  return ((lng + 180) / 360) * TILE * Math.pow(2, z);
}

function projectY(lat: number, z: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * Math.pow(2, z);
}

function unprojectX(x: number, z: number) {
  return (x / (TILE * Math.pow(2, z))) * 360 - 180;
}

function unprojectY(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * Math.pow(2, z));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function clampZoom(z: number) {
  return Math.max(MIN_Z, Math.min(MAX_Z, Math.round(z)));
}

function touchDistance(touches: any[]) {
  if (!touches || touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}


export function InteractiveMap({
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
}: {
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
}) {
  useColorTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState<LL>(user || OSLO);
  const [zoom, setZoom] = useState(15);
  const [manual, setManual] = useState(false);
  useEffect(() => { setManual(false); }, [focusRevision]);
  const smoothCar = useSmoothPosition(activeCar);

  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const panStartWorld = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(zoom);
  centerRef.current = center;
  zoomRef.current = zoom;

  const focus = useMemo(() => mapFocusPoints({ user, pickup, dropoff, activeCar, cars, focusMode, focusRoute }),
    [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, cars, focusMode, focusRoute]);

  const focusKey = focus.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  const insetsKey = JSON.stringify(contentInsets);

  useEffect(() => {
    if (manual || !size.w || !size.h) return;
    const fitted = fitMapView(focus, size.w, size.h, contentInsets);
    setCenter(fitted.center);
    setZoom(fitted.zoom);
  }, [focusKey, size.w, size.h, manual, insetsKey]);

  const recenter = () => {
    setManual(false);
    if (size.w && size.h) {
      const fitted = fitMapView(focus, size.w, size.h, contentInsets);
      setCenter(fitted.center);
      setZoom(fitted.zoom);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: (_e, g) => interactive && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onPanResponderGrant: (e) => {
        setManual(true);
        const z = zoomRef.current;
        panStartWorld.current = {
          x: projectX(centerRef.current.lng, z),
          y: projectY(centerRef.current.lat, z),
        };
        const touches = e.nativeEvent.touches as any[];
        pinchStartDistance.current = touchDistance(touches);
        pinchStartZoom.current = z;
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches as any[];
        if (touches?.length >= 2) {
          const distance = touchDistance(touches);
          if (pinchStartDistance.current > 0 && distance > 0) {
            const delta = Math.log2(distance / pinchStartDistance.current);
            const nextZoom = clampZoom(pinchStartZoom.current + delta * 1.35);
            if (nextZoom !== zoomRef.current) setZoom(nextZoom);
          }
          return;
        }

        const z = zoomRef.current;
        const start = panStartWorld.current;
        setCenter({
          lat: unprojectY(start.y - g.dy, z),
          lng: unprojectX(start.x - g.dx, z),
        });
      },
      onPanResponderRelease: () => {
        pinchStartDistance.current = 0;
      },
      onPanResponderTerminate: () => {
        pinchStartDistance.current = 0;
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const { w, h } = size;
  const originX = projectX(center.lng, zoom) - w / 2;
  const originY = projectY(center.lat, zoom) - h / 2;
  const sx = (lng: number) => projectX(lng, zoom) - originX;
  const sy = (lat: number) => projectY(lat, zoom) - originY;

  const baseTiles: React.ReactNode[] = [];
  const labelTiles: React.ReactNode[] = [];

  if (w && h) {
    const scale = Math.pow(2, zoom);
    const firstCol = Math.floor(originX / TILE);
    const firstRow = Math.floor(originY / TILE);
    const lastCol = Math.floor((originX + w) / TILE);
    const lastRow = Math.floor((originY + h) / TILE);

    for (let col = firstCol; col <= lastCol; col++) {
      for (let row = firstRow; row <= lastRow; row++) {
        if (row < 0 || row >= scale) continue;
        const tx = ((col % scale) + scale) % scale;
        const left = col * TILE - originX;
        const top = row * TILE - originY;
        const tileStyle = { position: 'absolute' as const, left, top, width: TILE, height: TILE };

        baseTiles.push(
          <Image
            key={`base-${zoom}-${tx}-${row}`}
            source={{ uri: baseTileUrl(zoom, tx, row) }}
            style={tileStyle}
            fadeDuration={0}
          />,
        );

        if (!MAPTILER_KEY) {
          labelTiles.push(
            <Image
              key={`label-${zoom}-${tx}-${row}`}
              source={{ uri: labelTileUrl(zoom, tx, row) }}
              style={tileStyle}
              fadeDuration={0}
            />,
          );
        }
      }
    }
  }

  const routeLine = (
    route && route.length > 1 ? route : []
  )
    .map(([lng, lat]) => `${sx(lng).toFixed(1)},${sy(lat).toFixed(1)}`)
    .join(' ');

  return (
    <View
      testID={testID}
      style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...(interactive ? pan.panHandlers : {})}
    >
      {w > 0 && h > 0 ? (
        <>
          {baseTiles}
          {labelTiles}

          <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
            {routeLine ? (
              <>
                <Polyline points={routeLine} fill="none" stroke={colors.surface} strokeOpacity={.9} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
                <Polyline points={routeLine} fill="none" stroke={colors.route} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}

            {cars.map((c, i) => <V10RasterCar key={(c as any).id || `car-${i}`} car={c} projectX={sx} projectY={sy} />)}

            {smoothCar ? (
              <>
                <Circle cx={sx(smoothCar.lng)} cy={sy(smoothCar.lat)} r={22} fill={colors.accentGlow} opacity={0.45} />
                <G transform={`translate(${sx(smoothCar.lng)}, ${sy(smoothCar.lat)}) rotate(${smoothCar.heading}) scale(1.25)`}>
                  <V10VehicleBody />
                </G>
              </>
            ) : null}

            {pickup ? (
              <G>
                <Ellipse cx={sx(pickup.lng)} cy={sy(pickup.lat) + 3} rx={10} ry={3.5} fill="#000" opacity={.16} /><Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={11} fill={colors.surface} stroke={colors.surfaceInverse} strokeWidth={1.2} strokeOpacity={.15} />
                <Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={6.4} fill={colors.accent} />
                <Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={2.4} fill="#fff" />
              </G>
            ) : null}

            {dropoff ? (
              <G>
                <Ellipse cx={sx(dropoff.lng)} cy={sy(dropoff.lat) + 3} rx={10} ry={3.5} fill="#000" opacity={.16} /><Rect x={sx(dropoff.lng) - 10.5} y={sy(dropoff.lat) - 10.5} width={21} height={21} rx={6.5} fill={colors.surfaceInverse} />
                <Rect x={sx(dropoff.lng) - 3.6} y={sy(dropoff.lat) - 3.6} width={7.2} height={7.2} rx={1.6} fill={colors.surface} />
              </G>
            ) : null}

            {user && (!pickup || Math.abs(user.lat - pickup.lat) > 1e-6 || Math.abs(user.lng - pickup.lng) > 1e-6) ? (
              <G>
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={22} fill="rgba(255,0,0,0.16)" />
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={9} fill={colors.accent} stroke="#FFFFFF" strokeWidth={2.5} />
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={3} fill="#FFFFFF" />
                <SvgText x={sx(user.lng)} y={sy(user.lat) - 18} fill={colors.text} fontSize="11" fontWeight="700" textAnchor="middle">Du er her</SvgText>
              </G>
            ) : null}
          </Svg>

          <Text style={{ position: 'absolute', bottom: 2, left: 6, fontSize: 8, color: colors.textMuted, pointerEvents: 'none' }}>
            {ATTRIB}
          </Text>

          {interactive && showControls ? (
            <View style={{ position: 'absolute', right: 14, top: Platform.OS === 'web' ? 108 : 116, gap: 8 }} pointerEvents="box-none">
              <Ctrl name="plus" onPress={() => { setManual(true); setZoom((z) => clampZoom(z + 1)); }} testID="map-zoom-in" />
              <Ctrl name="minus" onPress={() => { setManual(true); setZoom((z) => clampZoom(z - 1)); }} testID="map-zoom-out" />
              <Ctrl name="crosshair" onPress={recenter} testID="map-recenter" />
            </View>
          ) : null}
        </>
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

export const Map = InteractiveMap;
export default InteractiveMap;

