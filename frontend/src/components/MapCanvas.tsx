import React, { useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  G,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { colors, useColorTheme } from '@/src/theme';
import { CarShape, CAR_ACTIVE, CAR_IDLE } from './CarMarker';
import { useSmoothPosition } from './useSmoothPosition';

type LL = { lat: number; lng: number };
type Car = { lat: number; lng: number; heading?: number };

/**
 * Stylised Nordic dark "map" canvas rendered with SVG so it works identically on
 * web preview, Expo Go and native builds. Plots pickup / dropoff / route / nearby
 * cars / user beacon using the SNAR brass + granite palette.
 */
export function MapCanvas({
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
  route?: number[][] | null; // [[lng,lat], ...]
  cars?: Car[];
  activeCar?: Car | null;
  user?: LL | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  useColorTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const smoothCar = useSmoothPosition(activeCar);

  const pts: { lng: number; lat: number }[] = [];
  if (pickup) pts.push({ lng: pickup.lng, lat: pickup.lat });
  if (dropoff) pts.push({ lng: dropoff.lng, lat: dropoff.lat });
  if (route) route.forEach(([lng, lat]) => pts.push({ lng, lat }));
  cars.forEach((c) => pts.push({ lng: c.lng, lat: c.lat }));
  if (activeCar) pts.push({ lng: activeCar.lng, lat: activeCar.lat });
  if (user) pts.push({ lng: user.lng, lat: user.lat });

  let minLng = 10.68, maxLng = 10.79, minLat = 59.9, maxLat = 59.93; // Oslo default
  if (pts.length) {
    minLng = Math.min(...pts.map((p) => p.lng));
    maxLng = Math.max(...pts.map((p) => p.lng));
    minLat = Math.min(...pts.map((p) => p.lat));
    maxLat = Math.max(...pts.map((p) => p.lat));
    if (maxLng - minLng < 0.004) { const m = (minLng + maxLng) / 2; minLng = m - 0.004; maxLng = m + 0.004; }
    if (maxLat - minLat < 0.004) { const m = (minLat + maxLat) / 2; minLat = m - 0.004; maxLat = m + 0.004; }
  }
  const padX = (maxLng - minLng) * 0.18;
  const padY = (maxLat - minLat) * 0.22;
  minLng -= padX; maxLng += padX; minLat -= padY; maxLat += padY;

  const { w, h } = size;
  const px = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * w;
  const py = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat)) * h;

  const routePoints =
    route && route.length
      ? route.map(([lng, lat]) => `${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(' ')
      : pickup && dropoff
      ? `${px(pickup.lng).toFixed(1)},${py(pickup.lat).toFixed(1)} ${px(dropoff.lng).toFixed(1)},${py(dropoff.lat).toFixed(1)}`
      : '';

  // decorative static "roads" grid for texture
  const grid: React.ReactNode[] = [];
  if (w && h) {
    for (let i = 1; i < 6; i++) {
      grid.push(<Line key={`v${i}`} x1={(w / 6) * i} y1={0} x2={(w / 6) * i} y2={h} stroke={colors.mapRoad} strokeWidth={1} />);
    }
    for (let i = 1; i < 10; i++) {
      grid.push(<Line key={`h${i}`} x1={0} y1={(h / 10) * i} x2={w} y2={(h / 10) * i} stroke={colors.mapRoad} strokeWidth={1} />);
    }
    // a couple of "major" diagonal roads
    grid.push(<Line key="d1" x1={0} y1={h * 0.7} x2={w} y2={h * 0.35} stroke={colors.mapRoadMajor} strokeWidth={2.5} />);
    grid.push(<Line key="d2" x1={w * 0.2} y1={0} x2={w * 0.75} y2={h} stroke={colors.mapRoadMajor} strokeWidth={2.5} />);
  }

  return (
    <View
      testID={testID}
      style={[{ backgroundColor: colors.mapCanvas, overflow: 'hidden' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="45%" r="60%">
              <Stop offset="0%" stopColor="rgba(203,163,101,0.10)" />
              <Stop offset="100%" stopColor="rgba(203,163,101,0)" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={colors.mapCanvas} />
          <Rect x={0} y={0} width={w} height={h} fill="url(#glow)" />
          {grid}

          {routePoints ? (
            <>
              <Polyline points={routePoints} fill="none" stroke={colors.accent} strokeOpacity={0.28} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={routePoints} fill="none" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : null}

          {/* nearby cars */}
          {cars.map((c, i) => (
            <G
              key={`car${i}`}
              transform={`translate(${px(c.lng)}, ${py(c.lat)}) rotate(${c.heading || 0}) scale(${18 / 24}) translate(-12, -12)`}
            >
              <CarShape {...CAR_IDLE} />
            </G>
          ))}

          {/* active trip car (smoothly animated) */}
          {smoothCar ? (
            <>
              <Circle cx={px(smoothCar.lng)} cy={py(smoothCar.lat)} r={20} fill={colors.accentGlow} opacity={0.5} />
              <G
                transform={`translate(${px(smoothCar.lng)}, ${py(smoothCar.lat)}) rotate(${smoothCar.heading}) scale(${34 / 24}) translate(-12, -12)`}
              >
                <CarShape {...CAR_ACTIVE} />
              </G>
            </>
          ) : null}

          {/* pickup pin */}
          {pickup ? (
            <G>
              <Circle cx={px(pickup.lng)} cy={py(pickup.lat)} r={9} fill={colors.accentSoft} />
              <Circle cx={px(pickup.lng)} cy={py(pickup.lat)} r={5} fill={colors.accent} />
              <Circle cx={px(pickup.lng)} cy={py(pickup.lat)} r={2} fill={colors.text} />
            </G>
          ) : null}

          {/* dropoff pin */}
          {dropoff ? (
            <G>
              <Rect x={px(dropoff.lng) - 6} y={py(dropoff.lat) - 6} width={12} height={12} rx={2} fill={colors.bg} stroke={colors.accent} strokeWidth={2} />
              <Rect x={px(dropoff.lng) - 2.5} y={py(dropoff.lat) - 2.5} width={5} height={5} fill={colors.text} />
            </G>
          ) : null}

          {/* user beacon */}
          {user ? (
            <G>
              <Circle cx={px(user.lng)} cy={py(user.lat)} r={16} fill="rgba(203,163,101,0.12)" />
              <Circle cx={px(user.lng)} cy={py(user.lat)} r={6} fill={colors.accent} />
              <Circle cx={px(user.lng)} cy={py(user.lat)} r={2.5} fill={colors.text} />
            </G>
          ) : null}
        </Svg>
      )}
    </View>
  );
}
