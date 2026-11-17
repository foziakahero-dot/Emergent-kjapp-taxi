import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './Motion';

type LL = { lat: number; lng: number; heading?: number } | null | undefined;
type Pos = { lat: number; lng: number; heading: number };
const headingKnown = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const wrap = (n: number) => ((n % 360) + 360) % 360;

function bearing(a: Pos, b: NonNullable<LL>) {
  const rad = Math.PI / 180;
  const dLon = (b.lng - a.lng) * rad;
  return wrap(Math.atan2(Math.sin(dLon) * Math.cos(b.lat * rad),
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLon)) / rad);
}

/** GPS-driven motion only. North is 0°, turns take the shortest arc, and reduced motion snaps. */
export function useSmoothPosition(target: LL, duration = 900): Pos | null {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState<Pos | null>(target ? { lat: target.lat, lng: target.lng, heading: headingKnown(target.heading) ? wrap(target.heading) : 0 } : null);
  const latest = useRef(pos);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    const commit = (next: Pos | null) => { latest.current = next; setPos(next); };
    if (!target) { commit(null); return; }
    const from = latest.current;
    const moved = from && (Math.abs(from.lat - target.lat) >= 1e-7 || Math.abs(from.lng - target.lng) >= 1e-7);
    const heading = headingKnown(target.heading) ? wrap(target.heading) : from ? moved ? bearing(from, target) : from.heading : 0;
    const to = { lat: target.lat, lng: target.lng, heading };
    if (!from || reduced || duration <= 0) { commit(to); return; }
    const turn = ((heading - from.heading + 540) % 360) - 180;
    if (!moved && Math.abs(turn) < .01) return;
    const started = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - started) / duration);
      const ease = t * (2 - t);
      commit({ lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + (to.lng - from.lng) * ease, heading: wrap(from.heading + turn * ease) });
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  }, [target?.lat, target?.lng, target?.heading, duration, reduced]);
  // A removed GPS fix must never leave a stale car visible for another frame.
  return target ? pos : null;
}
