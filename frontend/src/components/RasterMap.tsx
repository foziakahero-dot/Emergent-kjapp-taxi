import { mapFocusPoints, MapFocusMode } from '@/src/lib/mapFocus';
import { Text } from '@/src/components/Typography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/src/theme';
import { Icon } from './Icon';
import { CarShape, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
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

function fitView(points: LL[], w: number, h: number) {
  if (!points.length) return { center: OSLO, zoom: 13 };
  if (points.length === 1) return { center: points[0], zoom: 16 };

  for (let z = MAX_Z; z >= MIN_Z; z--) {
    const xs = points.map((p) => projectX(p.lng, z));
    const ys = points.map((p) => projectY(p.lat, z));
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width <= w * 0.76 && height <= h * 0.46) {
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return {
        center: { lat: unprojectY(cy, z), lng: unprojectX(cx, z) },
        zoom: clampZoom(z),
      };
    }
  }

  return { center: points[0], zoom: 13 };
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
  focusMode = 'route',
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
  focusMode?: MapFocusMode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState<LL>(user || OSLO);
  const [zoom, setZoom] = useState(15);
  const [manual, setManual] = useState(false);
  const smoothCar = useSmoothPosition(activeCar);

  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const panStartWorld = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(zoom);
  centerRef.current = center;
  zoomRef.current = zoom;

  const focus = useMemo(() => mapFocusPoints({ user, pickup, dropoff, activeCar, cars, focusMode }),
    [user?.lat, user?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, cars, focusMode]);

  const focusKey = focus.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  useEffect(() => {
    if (manual || !size.w || !size.h) return;
    const fitted = fitView(focus, size.w, size.h);
    setCenter(fitted.center);
    setZoom(fitted.zoom);
  }, [focusKey, size.w, size.h, manual]);

  const recenter = () => {
    setManual(false);
    if (size.w && size.h) {
      const fitted = fitView(focus, size.w, size.h);
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

          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 110,
              backgroundColor: 'rgba(244,246,250,0.18)',
              pointerEvents: 'none',
            }}
          />

          <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
            {routeLine ? (
              <>
                <Polyline points={routeLine} fill="none" stroke={colors.accent} strokeOpacity={0.30} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                <Polyline points={routeLine} fill="none" stroke={colors.accent} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}

            {cars.map((c, i) => (
              <G key={`car-${i}`} transform={`translate(${sx(c.lng)}, ${sy(c.lat)}) rotate(${c.heading || 0}) scale(${20 / 24}) translate(-12, -12)`}>
                <CarShape {...CAR_IDLE} />
              </G>
            ))}

            {smoothCar ? (
              <>
                <Circle cx={sx(smoothCar.lng)} cy={sy(smoothCar.lat)} r={22} fill={colors.accentGlow} opacity={0.45} />
                <G transform={`translate(${sx(smoothCar.lng)}, ${sy(smoothCar.lat)}) rotate(${smoothCar.heading}) scale(${36 / 24}) translate(-12, -12)`}>
                  <CarShape {...CAR_ACTIVE} />
                </G>
              </>
            ) : null}

            {pickup ? (
              <G>
                <Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={10} fill={colors.accentSoft} />
                <Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={5.5} fill={colors.accent} />
                <Circle cx={sx(pickup.lng)} cy={sy(pickup.lat)} r={2} fill={colors.accentOn} />
              </G>
            ) : null}

            {dropoff ? (
              <G>
                <Rect x={sx(dropoff.lng) - 7} y={sy(dropoff.lat) - 7} width={14} height={14} rx={3} fill={colors.bg} stroke={colors.accent} strokeWidth={2.5} />
                <Rect x={sx(dropoff.lng) - 2.5} y={sy(dropoff.lat) - 2.5} width={5} height={5} fill={colors.text} />
              </G>
            ) : null}

            {user ? (
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

          {interactive ? (
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


