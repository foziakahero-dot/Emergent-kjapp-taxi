import { useEffect, useRef, useState } from 'react';

type LL = { lat: number; lng: number; heading?: number } | null | undefined;
type Pos = { lat: number; lng: number; heading: number };

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Tweens a marker position toward the latest polled coordinate so the car glides
 * smoothly instead of teleporting on every poll. Also derives a heading from the
 * travel direction when the source doesn't provide one.
 */
export function useSmoothPosition(target: LL, duration = 2200): Pos | null {
  const [pos, setPos] = useState<Pos | null>(
    target ? { lat: target.lat, lng: target.lng, heading: target.heading || 0 } : null,
  );
  const posRef = useRef<Pos | null>(pos);
  posRef.current = pos;
  const raf = useRef<any>(null);

  useEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const from = posRef.current;
    if (!from) {
      setPos({ lat: target.lat, lng: target.lng, heading: target.heading || 0 });
      return;
    }
    if (Math.abs(from.lat - target.lat) < 1e-7 && Math.abs(from.lng - target.lng) < 1e-7) {
      return;
    }
    const head =
      target.heading != null && target.heading !== 0
        ? target.heading
        : bearing(from, target);
    const start = Date.now();
    const startPos = { ...from };
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      setPos({
        lat: startPos.lat + (target.lat - startPos.lat) * e,
        lng: startPos.lng + (target.lng - startPos.lng) * e,
        heading: head,
      });
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, duration]);

  return pos;
}
