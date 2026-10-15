import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from '@/src/components/Motion';

type Route = number[][];
function validRoute(route: any): route is Route {
  return Array.isArray(route) && route.length > 1 && route.every(point => Array.isArray(point)
    && typeof point[0] === 'number' && typeof point[1] === 'number'
    && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
}

/** Reveals only the server's polyline; never changes the route, camera or GPS. */
export function routePrefix(route: Route, progress: number): Route {
  if (!validRoute(route) || !Number.isFinite(progress) || progress <= 0) return [];
  if (progress >= 1) return route;
  const lengths = route.slice(1).map((point, index) => Math.hypot(
    (point[0] - route[index][0]) * Math.cos((point[1] + route[index][1]) * Math.PI / 360), point[1] - route[index][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return route;
  let remaining = total * progress;
  const visible = [route[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (remaining >= lengths[i]) { visible.push(route[i + 1]); remaining -= lengths[i]; continue; }
    const fraction = remaining / lengths[i];
    visible.push([route[i][0] + (route[i + 1][0] - route[i][0]) * fraction,
      route[i][1] + (route[i + 1][1] - route[i][1]) * fraction]);
    break;
  }
  return visible;
}

export function useRouteReveal(route: Route | null | undefined, enabled = true): Route | null {
  const reduced = useReducedMotion();
  const key = useMemo(() => enabled && validRoute(route) ? JSON.stringify(route) : '', [route, enabled]);
  const geometry = useMemo<Route | null>(() => key ? JSON.parse(key) : null, [key]);
  const value = useRef(new Animated.Value(0)).current;
  const [frame, setFrame] = useState({ key: '', progress: 0 });
  useEffect(() => {
    if (!key || reduced) return;
    value.setValue(0);
    setFrame({ key, progress: 0 });
    let current = true;
    const listener = value.addListener(({ value: progress }) => { if (current) setFrame({ key, progress }); });
    const animation = Animated.timing(value, { toValue: 1, duration: 900, easing: Easing.bezier(.65, 0, .35, 1), useNativeDriver: false });
    animation.start();
    return () => { current = false; animation.stop(); value.removeListener(listener); };
  }, [key, reduced, value]);
  return geometry ? reduced ? geometry : routePrefix(geometry, frame.key === key ? frame.progress : 0) : null;
}
