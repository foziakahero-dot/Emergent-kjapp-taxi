import { Text } from '@/src/components/Typography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Polyline, Rect } from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';
import { Icon } from './Icon';
import { CarShape, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 16;
const OSLO = { lat: 59.9127, lng: 10.7461 };

// Real dark map tiles. MapTiler (if a key is provided via EXPO_PUBLIC_MAPTILER_KEY)
// otherwise Esri Dark Gray Canvas — both free of the Google/Apple native-module
// requirement, so they render on web preview, Expo Go and production builds.
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || '';
const ATTRIB = MAPTILER_KEY ? '© MapTiler · OpenStreetMap' : '© Esri · OpenStreetMap';
const tileUrl = (z: number, x: number, y: number) =>
  MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/${z}/${x}/${y}@2x.png?key=${MAPTILER_KEY}`
    : `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;

// --- Web Mercator projection (world pixel space at a given zoom) ---
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

function fitView(points: LL[], w: number, h: number) {
  if (!points.length) return { center: OSLO, zoom: 12 };
  if (points.length === 1) return { center: points[0], zoom: 14 };
  for (let z = MAX_Z; z >= MIN_Z; z--) {
    const xs = points.map((p) => projectX(p.lng, z));
    const ys = points.map((p) => projectY(p.lat, z));
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width <= w * 0.8 && height <= h * 0.5) {
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return { center: { lat: unprojectY(cy, z), lng: unprojectX(cx, z) }, zoom: Math.min(z, 16) };
    }
  }
  return { center: points[0], zoom: 12 };
}

export function TileMap({
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
  route?: number[][] | null; // [[lng,lat], ...]
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  interactive?: boolean;
}) {
  useColorTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [center, setCenter] = useState<LL>(OSLO);
  const [zoom, setZoom] = useState(13);
  const [manual, setManual] = useState(false);
  const smoothCar = useSmoothPosition(activeCar);

  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  centerRef.current = center;
  zoomRef.current = zoom;

  // Points that define the framing of the map.
  const focus = useMemo(() => {
    const pts: LL[] = [];
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    if (activeCar) pts.push({ lat: activeCar.lat, lng: activeCar.lng });
    if (user && !dropoff) pts.push(user);
    return pts;
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, activeCar?.lat, activeCar?.lng, user?.lat, user?.lng]);

  const focusKey = focus.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');

  // Auto-fit whenever the framing points change (until the user pans/zooms).
  useEffect(() => {
    if (manual || !size.w || !size.h) return;
    const f = fitView(focus, size.w, size.h);
    setCenter(f.center);
    setZoom(f.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, size.w, size.h, manual]);

  const recenter = () => {
    setManual(false);
    if (size.w && size.h) {
      const f = fitView(focus, size.w, size.h);
      setCenter(f.center);
      setZoom(f.zoom);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: (_e, g) => interactive && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),
      onPanResponderGrant: () => setManual(true),
      onPanResponderMove: (_e, g) => {
        const z = zoomRef.current;
        const startX = projectX(centerRef.current.lng, z);
        const startY = projectY(centerRef.current.lat, z);
        // g.dx/dy are cumulative from grant; apply against the grant center captured below
        const gx = grantCenter.current.x - g.dx;
        const gy = grantCenter.current.y - g.dy;
        setCenter({ lat: unprojectY(gy, z), lng: unprojectX(gx, z) });
        void startX; void startY;
      },
      onPanResponderStart: () => {
        grantCenter.current = {
          x: projectX(centerRef.current.lng, zoomRef.current),
          y: projectY(centerRef.current.lat, zoomRef.current),
        };
      },
    }),
  ).current;
  const grantCenter = useRef({ x: 0, y: 0 });

  const { w, h } = size;

  // Screen projection helpers for current view.
  const originX = projectX(center.lng, zoom) - w / 2;
  const originY = projectY(center.lat, zoom) - h / 2;
  const sx = (lng: number) => projectX(lng, zoom) - originX;
  const sy = (lat: number) => projectY(lat, zoom) - originY;

  // Tile grid covering the viewport.
  const tiles: React.ReactNode[] = [];
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
        tiles.push(
          <Image
            key={`${zoom}-${tx}-${row}`}
            source={{ uri: tileUrl(zoom, tx, row) }}
            style={{ position: 'absolute', left, top, width: TILE, height: TILE }}
            fadeDuration={0}
          />,
        );
      }
    }
  }

  const routeLine =
    (route && route.length ? route : pickup && dropoff ? [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]] : [])
      .map(([lng, lat]) => `${sx(lng).toFixed(1)},${sy(lat).toFixed(1)}`)
      .join(' ');

  return (
    <View
      testID={testID}
      style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...(interactive ? pan.panHandlers : {})}
    >
      {w > 0 && h > 0 && (
        <>
          {tiles}
          {/* subtle vignette so the dark UI blends with the map edges */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(6,9,10,0.35)', pointerEvents: 'none' }} />

          <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
            {routeLine ? (
              <>
                <Polyline points={routeLine} fill="none" stroke={colors.accent} strokeOpacity={0.3} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                <Polyline points={routeLine} fill="none" stroke={colors.accent} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : null}

            {cars.map((c, i) => (
              <G key={`car${i}`} transform={`translate(${sx(c.lng)}, ${sy(c.lat)}) rotate(${c.heading || 0}) scale(${20 / 24}) translate(-12, -12)`}>
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

            {user && !dropoff ? (
              <G>
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={18} fill="rgba(203,163,101,0.14)" />
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={7} fill={colors.accent} />
                <Circle cx={sx(user.lng)} cy={sy(user.lat)} r={2.6} fill={colors.accentOn} />
              </G>
            ) : null}
          </Svg>

          {/* attribution */}
          <Text
            style={{ position: 'absolute', bottom: 2, left: 6, fontSize: 8, color: 'rgba(244,244,240,0.35)', pointerEvents: 'none' }}
          >
            {ATTRIB}
          </Text>

          {interactive ? (
            <View style={{ position: 'absolute', right: 12, bottom: Platform.OS === 'web' ? 150 : 180, gap: 8 }}>
              <Ctrl name="plus" onPress={() => { setManual(true); setZoom((z) => Math.min(MAX_Z, z + 1)); }} testID="map-zoom-in" />
              <Ctrl name="minus" onPress={() => { setManual(true); setZoom((z) => Math.max(MIN_Z, z - 1)); }} testID="map-zoom-out" />
              <Ctrl name="crosshair" onPress={recenter} testID="map-recenter" />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function Ctrl({ name, onPress, testID }: { name: any; onPress: () => void; testID: string }) {
  useColorTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(12,18,22,0.92)',
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Icon name={name} size={20} color={colors.accentOn} />
    </Pressable>
  );
}

export const Map = TileMap;
export default TileMap;

