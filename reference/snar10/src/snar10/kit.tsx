import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

/* ─── Icons — one engineered line language, 1.8 stroke, round joins ─────── */
const P: Record<string, ReactNode> = {
  home: <><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/></>,
  activity: <><path d="M4 7h10M4 12h16M4 17h7"/><circle cx="18" cy="7" r="2"/></>,
  ai: <><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/><path d="M12 8.5a3.5 3.5 0 1 0 3.5 3.5"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/></>,
  message: <><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4.5 3.5V17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></>,
  profile: <><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></>,
  pickup: <><circle cx="12" cy="10" r="5.5"/><circle cx="12" cy="10" r="1.6" fill="currentColor"/><path d="M12 15.5V21"/></>,
  destination: <><rect x="6.5" y="4.5" width="11" height="11" rx="3"/><rect x="10.2" y="8.2" width="3.6" height="3.6" rx=".8" fill="currentColor"/><path d="M12 15.5V21"/></>,
  vehicle: <><path d="M4 15.5V12l2-4.5A2 2 0 0 1 7.8 6.3h8.4a2 2 0 0 1 1.8 1.2L20 12v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4.5 12h15M7 16.5V18M17 16.5V18"/><circle cx="8" cy="14" r=".6" fill="currentColor"/><circle cx="16" cy="14" r=".6" fill="currentColor"/></>,
  driver: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M4.5 10.5c4.5-1 10.5-1 15 0M10.3 13.5 8 19.5M13.7 13.5 16 19.5"/></>,
  trip: <><circle cx="6" cy="18" r="2"/><rect x="16" y="4" width="4" height="4" rx="1"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/></>,
  navigation: <><path d="M12 3.5 19 20l-7-3.5L5 20z"/></>,
  voice: <><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/></>,
  safety: <><path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="m9 12 2 2 4-4"/></>,
  payment: <><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10h17M7 14.5h3"/></>,
  receipt: <><path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/></>,
  fleet: <><path d="M3.5 17v-2.5l1.4-3a1.5 1.5 0 0 1 1.3-.9h5.6a1.5 1.5 0 0 1 1.3.9l1.4 3V17z"/><path d="M8 7.5l.8-1.6a1.5 1.5 0 0 1 1.3-.9h5.6a1.5 1.5 0 0 1 1.3.9l1.4 3V14H16"/><path d="M6 17v1.5M12 17v1.5"/></>,
  earnings: <><path d="M4 19.5h16"/><path d="M6.5 16v-4M11 16V8.5M15.5 16v-6M20 4.5l-5 4-4-2.5-6.5 4.5" strokeOpacity=".5"/></>,
  clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></>,
  star: <><path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></>,
  phone: <><path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z"/></>,
  x: <><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></>,
  chevR: <><path d="m10 6 6 6-6 6"/></>,
  chevL: <><path d="m14 6-6 6 6 6"/></>,
  chevD: <><path d="m6 10 6 6 6-6"/></>,
  chevU: <><path d="m6 14 6-6 6 6"/></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5h4"/></>,
  settings: <><circle cx="12" cy="12" r="2.8"/><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/></>,
  help: <><circle cx="12" cy="12" r="8"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.7" r=".5" fill="currentColor"/></>,
  access: <><circle cx="12" cy="5.5" r="1.6"/><path d="M5 9h14M12 9v5M9 20l3-6 3 6"/></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></>,
  locate: <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></>,
  wifiOff: <><path d="M4 9a12 12 0 0 1 4-2.3M20 9a12 12 0 0 0-7.5-2.9M7 12.5a7 7 0 0 1 3-1.6M17 12.5a7 7 0 0 0-1.4-1M10 16a3 3 0 0 1 4 0M4 4l16 16"/></>,
  alert: <><path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r=".5" fill="currentColor"/></>,
  share: <><path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M6 11v8.5h12V11"/></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19.5h14"/></>,
  door: <><path d="M6 20V4.5h9.5V20M4 20h16"/><circle cx="13" cy="12.5" r=".7" fill="currentColor"/></>,
  walk: <><circle cx="13" cy="4.8" r="1.6"/><path d="m10 21 2-6.5 2.5 2.5V21M9.5 11.5 12 8.5l3 3 2.5.5M12 8.5l-1 5"/></>,
  luggage: <><rect x="6.5" y="7" width="11" height="12.5" rx="2.5"/><path d="M9.5 7V4.5h5V7M10 11v5M14 11v5"/></>,
  work: <><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17"/></>,
  moon: <><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></>,
  camera: <><path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.5l1.5-2h5l1.5 2h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><circle cx="12" cy="13" r="3.5"/></>,
  doc: <><path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12h6M9 15.5h6"/></>,
  id: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 15.5c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3M14.5 13h3"/></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></>,
  power: <><path d="M12 3.5v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/></>,
  turnR: <><path d="M7 20v-7a4 4 0 0 1 4-4h8"/><path d="m15.5 5.5 3.5 3.5-3.5 3.5"/></>,
  arrowUp: <><path d="M12 20V5M6 11l6-6 6 6"/></>,
  arrowR: <><path d="M4 12h15M13 6l6 6-6 6"/></>,
  sun: <><circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></>,
  text: <><path d="M4 7V5h10v2M9 5v14M7 19h4M14 12v-1.5h6V12M17 10.5V19M15.5 19h3"/></>,
  contrast: <><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></>,
  globe: <><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.3 2.2 3.4 4.9 3.4 8s-1.1 5.8-3.4 8c-2.3-2.2-3.4-4.9-3.4-8S9.7 6.2 12 4z"/></>,
  timer: <><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M9.5 3.5h5"/></>,
  battery: <><rect x="3.5" y="8" width="15" height="8" rx="2"/><path d="M20.5 11v2"/><rect x="5.5" y="10" width="9" height="4" rx="1" fill="currentColor" stroke="none"/></>,
  signal: <><path d="M5 18v-2M9.5 18v-5M14 18v-8M18.5 18V6"/></>,
  more: <><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></>,
  send: <><path d="M4.5 12 19.5 4.5 15 19.5l-3.5-6z"/><path d="m11.5 13.5 8-9"/></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></>,
  heart: <><path d="M12 19.5s-7.5-4.4-7.5-10A4 4 0 0 1 12 7.3a4 4 0 0 1 7.5 2.2c0 5.6-7.5 10-7.5 10z"/></>,
  inside: <><path d="M4 10.5 12 4l8 6.5V20H4z"/><circle cx="12" cy="14" r="2"/></>,
  user: <><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5"/></>,
  apple: <><path d="M15.5 3.5c0 1.6-1.2 3-2.8 3.1-.1-1.5 1.2-3 2.8-3.1zM12.7 7.4c.9 0 1.9-.7 3.2-.7 1.4 0 2.6.7 3.3 1.8-2.9 1.6-2.4 5.6.5 6.7-.6 1.6-1.7 3.6-3.2 3.6-1.2 0-1.6-.7-3-.7s-1.9.7-3 .7c-2 0-4.5-4.2-4.5-7.9 0-3 1.9-4.4 3.6-4.4 1.3 0 2.2.9 3.1.9z" fill="currentColor" stroke="none"/></>,
  google: <><path d="M20 12.2c0-.6 0-1.1-.1-1.7H12v3.3h4.5a3.9 3.9 0 0 1-1.7 2.5v2.1h2.7c1.6-1.5 2.5-3.7 2.5-6.2z" fill="#4285F4" stroke="none"/><path d="M12 20.5c2.3 0 4.2-.8 5.5-2.1l-2.7-2.1c-.7.5-1.7.8-2.8.8-2.2 0-4-1.5-4.7-3.4H4.5v2.2a8.5 8.5 0 0 0 7.5 4.6z" fill="#34A853" stroke="none"/><path d="M7.3 13.7a5 5 0 0 1 0-3.4V8.1H4.5a8.5 8.5 0 0 0 0 7.8z" fill="#FBBC05" stroke="none"/><path d="M12 6.9c1.2 0 2.3.4 3.2 1.3l2.4-2.4A8.3 8.3 0 0 0 12 3.5a8.5 8.5 0 0 0-7.5 4.6l2.8 2.2C8 8.4 9.8 6.9 12 6.9z" fill="#EA4335" stroke="none"/></>,
};
export function Icon({ name, size = 22, stroke = 1.8, style }: { name: string; size?: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", ...style }}>
      {P[name] ?? P.more}
    </svg>
  );
}

/* ─── Brand ─────────────────────────────────────────────────────────────── */
export function SnarMark({ size = 40, light = false }: { size?: number; light?: boolean }) {
  const id = `s10g-${size}-${light ? 1 : 0}`;
  return (
    <svg aria-label="SNAR" width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={id} x1=".1" y1="-.07" x2=".9" y2="1.07">
          <stop stopColor="#ff3b3b" /><stop offset=".55" stopColor="#ff0000" /><stop offset="1" stopColor="#b30000" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill={`url(#${id})`} />
      <path d="M28 29l21 21-21 21" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M53 29l21 21-21 21" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Splash: the chevrons are traced by a single light that travels like a route. */
export function SplashMark({ label }: { label?: string }) {
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 22 }}>
      <div style={{ position: "relative", width: 96, height: 96 }} className="s10-pop">
        <SnarMark size={96} />
        <svg viewBox="0 0 100 100" width={96} height={96} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          <path d="M28 29l21 21-21 21M53 29l21 21-21 21" pathLength={1} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray=".18 1.2" style={{ animation: "s10-light 1.6s cubic-bezier(.65,0,.35,1) .2s both", filter: "drop-shadow(0 0 3px rgba(255,255,255,.9))" }} />
        </svg>
      </div>
      <div className="s10-in-3" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: ".18em" }}>SNAR</div>
        {label && <div className="t-cap" style={{ marginTop: 4, letterSpacing: ".14em", textTransform: "uppercase" }}>{label}</div>}
      </div>
    </div>
  );
}

/* ─── Geometry ──────────────────────────────────────────────────────────── */
export type Pt = [number, number];
export function along(pts: Pt[], t: number) {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 0;
      const a = pts[i], b = pts[i + 1];
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, heading: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 90 };
    }
    d -= segs[i];
  }
  return { x: pts[0][0], y: pts[0][1], heading: 0 };
}
const poly = (pts: Pt[]) => "M" + pts.map((p) => p.join(" ")).join(" L");

export const PICKUP: Pt = [300, 700];
export const DEST: Pt = [600, 360];
export const TRIP_ROUTE: Pt[] = [[300, 700], [300, 620], [352, 568], [440, 548], [500, 480], [540, 404], [600, 360]];
export const APPROACH_ROUTE: Pt[] = [[110, 900], [170, 830], [232, 780], [300, 760], [300, 700]];
/** Driver-side: from driver to pickup (Majorstuen) */
export const DRIVER_PICKUP_ROUTE: Pt[] = [[520, 820], [440, 790], [380, 760], [300, 760], [300, 700]];

/* ─── SNAR Map ──────────────────────────────────────────────────────────── */
export type Cam = "wide" | "home" | "search" | "route" | "driverSearch" | "approach" | "pickup" | "trip" | "arrival" | "cockpit" | "driverNav";
const CAMS: Record<Exclude<Cam, "trip" | "driverNav">, { x: number; y: number; s: number }> = {
  wide: { x: 420, y: 640, s: 0.5 },
  home: { x: 300, y: 720, s: 1.3 },
  search: { x: 300, y: 640, s: 1.05 },
  route: { x: 450, y: 660, s: 0.74 },
  driverSearch: { x: 300, y: 740, s: 1.6 },
  approach: { x: 230, y: 860, s: 1.05 },
  pickup: { x: 300, y: 730, s: 2.2 },
  arrival: { x: 600, y: 410, s: 1.9 },
  cockpit: { x: 380, y: 680, s: 0.92 },
};
const W = 370, H = 824;

const MAJOR: Pt[][] = [
  [[-40, 760], [180, 760], [300, 760], [420, 780], [560, 830], [800, 860]],
  [[300, 1300], [300, 700], [300, 620], [352, 568], [440, 548], [640, 520], [900, 500]],
  [[540, 404], [500, 480], [470, 700], [460, 1300]],
  [[-40, 420], [200, 400], [400, 380], [600, 360], [900, 340]],
  [[110, 900], [170, 830], [232, 780]],
];
const ROADS: Pt[][] = [
  [[440, 548], [500, 480], [540, 404], [560, 200]], [[200, 400], [210, 600], [232, 780]], [[100, 300], [180, 1100]],
  [[352, 568], [200, 560], [40, 540]], [[600, 360], [640, 600], [700, 900]], [[380, 380], [370, 120]],
  [[-40, 980], [300, 1000], [800, 980]], [[620, 200], [900, 260]],
];
const STREETS: Pt[][] = [];
for (let x = 60; x < 820; x += 64) STREETS.push([[x, 120], [x + 12, 1200]]);
for (let y = 140; y < 1200; y += 58) STREETS.push([[-40, y], [860, y + 10]]);
const BLDG: { x: number; y: number; w: number; h: number }[] = [];
for (let gx = 0; gx < 13; gx++) for (let gy = 0; gy < 19; gy++) {
  const x = 66 + gx * 64 + (gy % 2) * 2, y = 146 + gy * 58 + gx * 0.8;
  const seed = (gx * 31 + gy * 17) % 7;
  if (seed === 0) continue;
  BLDG.push({ x: x + 6, y: y + 6, w: 22 + (seed % 3) * 6, h: 18 + (seed % 2) * 10 });
  if (seed > 3) BLDG.push({ x: x + 36, y: y + 8, w: 16, h: 30 });
}
const DISTRICTS: [string, number, number][] = [["Majorstuen", 250, 800], ["Frogner", 130, 640], ["Sentrum", 560, 470], ["Grünerløkka", 700, 300], ["Bislett", 420, 640], ["Bjørvika", 680, 700], ["St. Hanshaugen", 420, 260]];
const STREET_LABELS: [string, number, number, number][] = [["Kirkeveien", 140, 752, 0], ["Bogstadveien", 292, 900, -90], ["Pilestredet", 410, 556, -14], ["Ullevålsveien", 524, 452, -62], ["Thereses gate", 360, 375, -4], ["Karl Johans gate", 610, 520, -5]];

type Ambient = { id: number; path: Pt[]; color: string; off: number };
const AMBIENT: Ambient[] = [
  { id: 1, path: [[180, 760], [300, 760], [420, 780]], color: "#1b1f24", off: 0 },
  { id: 2, path: [[300, 900], [300, 760], [300, 640]], color: "#e9ecef", off: 0.3 },
  { id: 3, path: [[200, 400], [400, 380], [600, 360]], color: "#1b1f24", off: 0.5 },
  { id: 4, path: [[352, 568], [200, 560], [80, 545]], color: "#7d8794", off: 0.1 },
  { id: 5, path: [[470, 700], [500, 480], [540, 404]], color: "#e9ecef", off: 0.7 },
  { id: 6, path: [[210, 600], [232, 780]], color: "#2c3a4d", off: 0.4 },
  { id: 7, path: [[560, 830], [420, 780], [330, 765]], color: "#1b1f24", off: 0.6 },
  { id: 8, path: [[640, 600], [600, 360]], color: "#7d8794", off: 0.2 },
  { id: 9, path: [[312, 790], [334, 776]], color: "#e9ecef", off: 0 },
];

/** Simplified 3D vehicle: soft contact shadow, gradient body, glass, roof — reads at 20 px. */
export function VehicleMarker({ x, y, heading, scale = 1, color = "#1b1f24", state = "available", smooth = true, dur = 1800 }: {
  x: number; y: number; heading: number; scale?: number; color?: string; state?: "available" | "selected" | "approaching" | "muted"; smooth?: boolean; dur?: number;
}) {
  const sel = state === "selected" || state === "approaching";
  const k = scale * (sel ? 1.25 : 1);
  const light = color === "#e9ecef" || color === "#ffffff";
  const gid = `vb-${color.replace("#", "")}`;
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: smooth ? `transform ${dur}ms linear` : undefined, opacity: state === "muted" ? 0.45 : 1 }}>
      <g style={{ transform: `scale(${k})`, transition: "transform 320ms cubic-bezier(.34,1.32,.52,1)" }}>
        {sel && <circle r="20" style={{ fill: "var(--primary)", opacity: 0.1 }} />}
        {sel && <circle r="20" fill="none" style={{ stroke: "var(--primary)", strokeOpacity: 0.35 }} strokeWidth="1" />}
        <g style={{ transform: `rotate(${heading}deg)`, transition: "transform 600ms cubic-bezier(.2,.8,.2,1)" }}>
          <defs>
            <linearGradient id={gid} x1="0" x2="1">
              <stop offset="0" stopColor={color} stopOpacity={light ? 0.82 : 0.9} />
              <stop offset=".5" stopColor={light ? "#ffffff" : color} />
              <stop offset="1" stopColor={color} stopOpacity={light ? 0.8 : 0.85} />
            </linearGradient>
          </defs>
          <ellipse cx="1.4" cy="2.2" rx="7.6" ry="12.6" fill="#000" opacity=".22" />
          <rect x="-6.6" y="-11.8" width="13.2" height="23.6" rx="4.4" fill={`url(#${gid})`} stroke={light ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.12)"} strokeWidth=".6" />
          <path d="M-5.2 -5.4 Q0 -7.6 5.2 -5.4 L4.4 -1.8 L-4.4 -1.8Z" fill="#0c1520" opacity=".86" />
          <rect x="-4.4" y="-1.6" width="8.8" height="6.6" rx="1.6" fill={light ? "#dfe3e8" : color} opacity=".95" />
          <path d="M-4.4 5.2 L4.4 5.2 L5 8.4 Q0 9.8 -5 8.4Z" fill="#0c1520" opacity=".75" />
          <rect x="-5.6" y="-11.4" width="2.4" height="1.2" rx=".6" fill="#fff8e0" opacity=".9" />
          <rect x="3.2" y="-11.4" width="2.4" height="1.2" rx=".6" fill="#fff8e0" opacity=".9" />
          <rect x="-5.6" y="10.4" width="2.4" height="1" rx=".5" fill="#ff2b2b" opacity=".8" />
          <rect x="3.2" y="10.4" width="2.4" height="1" rx=".5" fill="#ff2b2b" opacity=".8" />
        </g>
      </g>
    </g>
  );
}

function Cluster({ x, y, n, scale }: { x: number; y: number; n: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle r="17" style={{ fill: "var(--surface)" }} stroke="rgba(0,0,0,.08)" />
      <circle r="17" fill="none" style={{ stroke: "var(--text-primary)" }} strokeOpacity=".15" strokeWidth="4" />
      <text textAnchor="middle" dy="4.5" fontSize="13" fontWeight="600" style={{ fill: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{n}</text>
    </g>
  );
}

function PickupMarker({ x, y, scale, pulse }: { x: number; y: number; scale: number; pulse?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {pulse && [0, 0.8].map((d) => (
        <circle key={d} r="14" fill="none" style={{ stroke: "var(--primary)", transformBox: "fill-box", transformOrigin: "center", animation: `s10-pulse 2.4s cubic-bezier(.2,.8,.2,1) ${d}s infinite` }} strokeWidth="1.2" />
      ))}
      <ellipse cy="3" rx="10" ry="3.5" fill="#000" opacity=".16" />
      <circle r="11" style={{ fill: "var(--surface)" }} />
      <circle r="11" fill="none" style={{ stroke: "var(--surface-inverse)" }} strokeWidth="1.2" strokeOpacity=".15" />
      <circle r="6.4" style={{ fill: "var(--primary)" }} />
      <circle r="2.4" fill="#fff" />
    </g>
  );
}
function DestMarker({ x, y, scale, label }: { x: number; y: number; scale: number; label?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cy="3" rx="10" ry="3.5" fill="#000" opacity=".16" />
      <rect x="-10.5" y="-10.5" width="21" height="21" rx="6.5" style={{ fill: "var(--surface-inverse)" }} />
      <rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="1.6" style={{ fill: "var(--surface)" }} />
      {label && (
        <g transform="translate(16 -10)">
          <rect width={label.length * 7 + 18} height="22" rx="8" style={{ fill: "var(--surface)" }} stroke="rgba(0,0,0,.06)" />
          <text x="9" y="15" fontSize="12" fontWeight="600" style={{ fill: "var(--text-primary)" }}>{label}</text>
        </g>
      )}
    </g>
  );
}
function EtaTag({ x, y, scale, top, bottom, dark }: { x: number; y: number; scale: number; top: string; bottom?: string; dark?: boolean }) {
  const w = Math.max(top.length, (bottom ?? "").length) * 7 + 20;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ transition: "transform 900ms linear" }}>
      <g transform={`translate(${-w / 2} -52)`}>
        <rect width={w} height={bottom ? 36 : 24} rx="9" style={{ fill: dark ? "var(--surface-inverse)" : "var(--surface)" }} stroke="rgba(0,0,0,.06)" />
        <text x={w / 2} y={bottom ? 15 : 16} textAnchor="middle" fontSize="12.5" fontWeight="600" style={{ fill: dark ? "var(--on-inverse)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{top}</text>
        {bottom && <text x={w / 2} y="29" textAnchor="middle" fontSize="10" fontWeight="500" style={{ fill: dark ? "var(--on-inverse)" : "var(--text-tertiary)", opacity: 0.7 }}>{bottom}</text>}
      </g>
    </g>
  );
}

export type MapProps = {
  cam: Cam; fleet?: boolean; route?: "none" | "preview" | "trip" | "approach" | "driverPickup";
  progress?: number; showPickup?: boolean; showDest?: boolean; destLabel?: string; pulse?: boolean; searching?: boolean;
  driver?: { t: number; path: "approach" | "trip" | "driverPickup"; eta?: string; sub?: string; color?: string };
  demand?: boolean; dim?: number; offsetY?: number;
};
/** One coherent spatial canvas. Camera presets drive zoom-dependent detail (LOD). */
export function SnarMap({ cam, fleet = true, route = "none", progress = 0, showPickup, showDest, destLabel, pulse, searching, driver, demand, dim = 0, offsetY = 0 }: MapProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((v) => v + 1), 1800); return () => clearInterval(t); }, []);
  const dPath = driver ? (driver.path === "approach" ? APPROACH_ROUTE : driver.path === "trip" ? TRIP_ROUTE : DRIVER_PICKUP_ROUTE) : null;
  const dp = dPath && driver ? along(dPath, driver.t) : null;
  let c = cam === "trip" || cam === "driverNav" ? { x: dp?.x ?? 300, y: (dp?.y ?? 600) + 60, s: cam === "driverNav" ? 1.7 : 1.2 } : CAMS[cam];
  const s = c.s, inv = 1 / Math.max(0.7, Math.min(1.5, s)) ;
  const tx = -c.x * s + W / 2, ty = -c.y * s + H / 2 + offsetY;
  const lod = s < 0.7 ? "wide" : s < 1.6 ? "mid" : "close";
  const routePts = route === "approach" ? APPROACH_ROUTE : route === "driverPickup" ? DRIVER_PICKUP_ROUTE : TRIP_ROUTE;
  const relevant = route !== "none";
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, display: "block" }} role="img" aria-label="SNAR-kart">
      <rect width={W} height={H} style={{ fill: "var(--m-land)" }} />
      <g className="s10-map-cam" style={{ transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <path d="M-200 1000 C 40 960 120 1100 260 1080 S 560 1060 700 1140 L 900 1400 L -200 1400Z M 640 760 C 720 740 820 780 900 760 L 900 1400 L 700 1400 C 720 1100 600 900 640 760Z" style={{ fill: "var(--m-water)" }} />
        <path d="M60 470 q60 -30 110 10 q20 60 -40 90 q-80 10 -70 -100z M600 600 q50 -20 80 20 l-10 60 q-60 10 -70 -80z M330 270 q50 0 60 40 q-10 40 -60 30 q-30 -40 0 -70z" style={{ fill: "var(--m-park)" }} />
        {demand && (
          <g>
            <circle cx="300" cy="740" r="120" style={{ fill: "var(--primary)" }} opacity=".05" />
            <circle cx="300" cy="740" r="70" style={{ fill: "var(--primary)" }} opacity=".05" />
            <circle cx="600" cy="420" r="90" style={{ fill: "var(--warning)" }} opacity=".05" />
          </g>
        )}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: relevant ? 0.7 : 1, transition: "opacity 400ms" }}>
          {lod !== "wide" && STREETS.map((p, i) => <path key={i} d={poly(p)} style={{ stroke: "var(--m-street)" }} strokeWidth={lod === "close" ? 7 : 4.5} />)}
          {ROADS.map((p, i) => <path key={i} d={poly(p)} style={{ stroke: "var(--m-casing)" }} strokeWidth="11" opacity=".5" />)}
          {ROADS.map((p, i) => <path key={"r" + i} d={poly(p)} style={{ stroke: "var(--m-road)" }} strokeWidth="9" />)}
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {MAJOR.map((p, i) => <path key={i} d={poly(p)} style={{ stroke: "var(--m-casing)" }} strokeWidth="17" opacity=".6" />)}
          {MAJOR.map((p, i) => <path key={"m" + i} d={poly(p)} style={{ stroke: "var(--m-major)" }} strokeWidth="14" />)}
        </g>
        {lod !== "wide" && (
          <g style={{ opacity: lod === "close" ? 1 : 0.55, transition: "opacity 500ms" }}>
            {BLDG.map((b, i) => (
              <g key={i}>
                {lod === "close" && <rect x={b.x + 2} y={b.y + 3} width={b.w} height={b.h} rx="2" fill="#000" opacity=".07" />}
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" style={{ fill: lod === "close" ? "var(--m-bld-top)" : "var(--m-bld)" }} />
              </g>
            ))}
          </g>
        )}
        {lod === "close" && (
          <g>
            <rect x="314" y="676" width="40" height="34" rx="3" style={{ fill: "var(--m-bld-top)" }} stroke="rgba(0,0,0,.06)" />
            <g transform="translate(311 700)"><rect x="-7" y="-6" width="14" height="12" rx="3.5" style={{ fill: "var(--surface-inverse)" }} /><text textAnchor="middle" y="3.3" fontSize="8" fontWeight="700" style={{ fill: "var(--on-inverse)" }}>B</text></g>
            <g transform="translate(338 672)"><rect x="-7" y="-6" width="14" height="12" rx="3.5" style={{ fill: "var(--surface)" }} stroke="rgba(0,0,0,.12)" /><text textAnchor="middle" y="3.3" fontSize="8" fontWeight="700" style={{ fill: "var(--text-secondary)" }}>A</text></g>
            <path d="M311 706 L 304 704" style={{ stroke: "var(--text-primary)" }} strokeWidth="1.2" strokeDasharray="1.5 2.5" strokeLinecap="round" />
          </g>
        )}
        {lod === "wide" && DISTRICTS.map(([n, x, y]) => (
          <text key={n} x={x} y={y} textAnchor="middle" fontSize={22} fontWeight="600" letterSpacing="2" style={{ fill: "var(--m-label)", textTransform: "uppercase" }} opacity=".75">{n.toUpperCase()}</text>
        ))}
        {lod !== "wide" && STREET_LABELS.map(([n, x, y, r]) => (
          <text key={n} transform={`translate(${x} ${y}) rotate(${r})`} textAnchor="middle" fontSize={lod === "close" ? 6 : 9} fontWeight="500" style={{ fill: "var(--m-label)", paintOrder: "stroke", stroke: "var(--m-land)", strokeWidth: 3 }} opacity={relevant ? 0.55 : 0.9}>{n}</text>
        ))}
        {lod === "mid" && !relevant && DISTRICTS.slice(0, 3).map(([n, x, y]) => (
          <text key={n} x={x} y={y - 30} textAnchor="middle" fontSize="11" fontWeight="600" letterSpacing="1.5" style={{ fill: "var(--m-label)" }} opacity=".5">{n.toUpperCase()}</text>
        ))}
        {route !== "none" && (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={poly(routePts)} style={{ stroke: "var(--surface)" }} strokeWidth={7 * inv} opacity=".9" />
            <path key={route + cam} d={poly(routePts)} pathLength={1} strokeDasharray="1 1" style={{ stroke: "var(--m-route)", animation: "s10-draw 900ms cubic-bezier(.65,0,.35,1) both" }} strokeWidth={4 * inv} />
            {progress > 0 && <path d={poly(routePts)} pathLength={1} strokeDasharray={`${progress} 1`} style={{ stroke: "var(--m-land)", transition: "stroke-dasharray 900ms linear" }} strokeWidth={4.6 * inv} />}
            {progress > 0 && <path d={poly(routePts)} pathLength={1} strokeDasharray={`${progress} 1`} style={{ stroke: "var(--text-tertiary)", transition: "stroke-dasharray 900ms linear" }} strokeWidth={2 * inv} strokeOpacity=".6" />}
          </g>
        )}
        {searching && (
          <g transform={`translate(${PICKUP[0]} ${PICKUP[1]})`}>
            {[0, 1, 2].map((i) => <circle key={i} r="40" fill="none" style={{ stroke: "var(--primary)", transformBox: "fill-box", transformOrigin: "center", animation: `s10-pulse 3s cubic-bezier(.2,.8,.2,1) ${i}s infinite` }} strokeWidth=".7" />)}
            <g style={{ animation: "s10-sweep 3.2s linear infinite" }}>
              <path d="M0 0 L0 -90 A90 90 0 0 1 63 -64Z" style={{ fill: "var(--primary)" }} opacity=".06" />
            </g>
          </g>
        )}
        {fleet && lod === "wide" && (<><Cluster x={240} y={760} n={7} scale={2} /><Cluster x={560} y={400} n={12} scale={2} /><Cluster x={180} y={560} n={4} scale={2} /><Cluster x={650} y={640} n={5} scale={2} /></>)}
        {fleet && lod !== "wide" && AMBIENT.map((a) => {
          const t = ((tick * 0.12 + a.off) % 1);
          const q = along(a.path, t);
          const st = searching ? (a.id === 1 || a.id === 9 ? "approaching" : "available") : driver ? "muted" : "available";
          return <VehicleMarker key={a.id} x={q.x} y={q.y} heading={q.heading} color={a.color} scale={inv} state={st as "available"} />;
        })}
        {showPickup && <PickupMarker x={PICKUP[0]} y={PICKUP[1]} scale={inv} pulse={pulse} />}
        {showDest && <DestMarker x={DEST[0]} y={DEST[1]} scale={inv} label={destLabel} />}
        {dp && driver && <VehicleMarker x={dp.x} y={dp.y} heading={dp.heading} color={driver.color ?? "#1b1f24"} scale={inv} state="selected" dur={900} />}
        {dp && driver?.eta && <EtaTag x={dp.x} y={dp.y} scale={inv} top={driver.eta} bottom={driver.sub} dark />}
      </g>
      {dim > 0 && <rect width={W} height={H} style={{ fill: "var(--bg)", opacity: dim, transition: "opacity 300ms" }} />}
    </svg>
  );
}

/* ─── Phone, Dock, Island ───────────────────────────────────────────────── */
export function Phone({ theme, motion, children, statusOnDark }: { theme: "light" | "dark"; motion: "full" | "reduced"; children: ReactNode; statusOnDark?: boolean }) {
  return (
    <div className="s10-phone">
      <div className="s10 s10-screen" data-theme={theme} data-motion={motion}>
        <div className="s10-notch" />
        <div className="s10-status num" style={{ color: statusOnDark ? "#fff" : "var(--text-primary)" }}>
          <span>09:41</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Icon name="signal" size={17} stroke={2.2} /><Icon name="battery" size={22} stroke={1.6} /></span>
        </div>
        {children}
        <div className="s10-home-ind" />
      </div>
    </div>
  );
}

export type DockItem = { id: string; label: string; icon: string; ai?: boolean; dot?: boolean };
export function Dock({ items, active, onSelect }: { items: DockItem[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav className="s10-dock s10-glass" aria-label="Hovednavigasjon">
      {items.map((it) => (
        <button key={it.id} aria-current={active === it.id} aria-label={it.label} onClick={() => onSelect(it.id)} className={it.ai ? "ai" : ""}>
          <Icon name={it.icon} size={it.ai ? 24 : 22} />
          {!it.ai && <span>{it.label}</span>}
          {it.dot && <i className="dot" />}
        </button>
      ))}
    </nav>
  );
}

export function Island({ icon = "vehicle", title, sub, eta, etaUnit = "min", progress = 0, onClick, live = true }: { icon?: string; title: string; sub: string; eta?: string; etaUnit?: string; progress?: number; onClick: () => void; live?: boolean }) {
  return (
    <button className="s10-island" onClick={onClick} aria-label={`Aktiv tur: ${title}. Trykk for å åpne.`} key={title}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(127,127,127,.18)", display: "grid", placeItems: "center", position: "relative" }}>
        <Icon name={icon} size={20} />
        {live && <i style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5, background: "var(--primary)", boxShadow: "0 0 0 2px var(--surface-inverse)" }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </span>
      {eta && <span className="num" style={{ textAlign: "right" }}><b style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>{eta}</b><span style={{ fontSize: 12, opacity: 0.6, marginLeft: 3 }}>{etaUnit}</span></span>}
      <Icon name="chevU" size={18} style={{ opacity: 0.5 }} />
      <span className="prog"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
    </button>
  );
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, marginBottom: 8 }}>
      {onBack && <button className="s10-icbtn" onClick={onBack} aria-label="Tilbake" style={{ marginLeft: -12 }}><Icon name="chevL" /></button>}
      <div className="t-body-m" style={{ flex: 1, textAlign: onBack ? "center" : "left", marginRight: onBack && !right ? 36 : 0 }}>{title}</div>
      {right}
    </div>
  );
}

export function Avatar({ name, size = 48, src }: { name: string; size?: number; src?: string }) {
  return src ? (
    <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size, borderRadius: size * 0.34, objectFit: "cover", flex: "none" }} />
  ) : (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.34, background: "var(--surface-subtle)", display: "grid", placeItems: "center", fontWeight: 600, fontSize: size * 0.36, flex: "none" }}>{name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
  );
}

/** Large-glyph state screen — every error speaks human, offers one way forward. */
export function StateView({ icon, tone = "neu", title, body, action, secondary, onAction, onSecondary }: { icon: string; tone?: "neu" | "warn" | "crit"; title: string; body: string; action: string; secondary?: string; onAction?: () => void; onSecondary?: () => void }) {
  const col = tone === "crit" ? "var(--critical)" : tone === "warn" ? "var(--warning)" : "var(--text-primary)";
  const bg = tone === "crit" ? "var(--critical-soft)" : tone === "warn" ? "var(--warning-soft)" : "var(--surface-subtle)";
  return (
    <div className="s10-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: bg, color: col, display: "grid", placeItems: "center" }}><Icon name={icon} size={26} /></span>
      <div><div className="t-heading">{title}</div><p className="t-sec" style={{ marginTop: 6 }}>{body}</p></div>
      <div style={{ display: "grid", gap: 4 }}>
        <button className="s10-btn ink sm" onClick={onAction}>{action}</button>
        {secondary && <button className="s10-btn ghost sm" onClick={onSecondary}>{secondary}</button>}
      </div>
    </div>
  );
}

export function Ring({ value, size = 44, stroke = 3, color = "var(--primary)" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = size / 2 - stroke;
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "var(--divider-strong)" }} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" pathLength={1} strokeDasharray={`${value} 1`} strokeLinecap="round" style={{ stroke: color, transition: "stroke-dasharray 1s linear" }} strokeWidth={stroke} />
    </svg>
  );
}

/** Hold-to-confirm: prevents accidental trip start/completion. */
export function HoldButton({ label, onDone, tone = "primary", ms = 900 }: { label: string; onDone: () => void; tone?: "primary" | "ink"; ms?: number }) {
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const run = () => {
    start.current = performance.now();
    const step = (t: number) => {
      const v = Math.min(1, (t - start.current) / ms);
      setP(v);
      if (v < 1) raf.current = requestAnimationFrame(step); else { onDone(); setP(0); }
    };
    raf.current = requestAnimationFrame(step);
  };
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); setP(0); };
  return (
    <button className={`s10-btn ${tone}`} style={{ position: "relative", overflow: "hidden", height: 58 }} onPointerDown={run} onPointerUp={stop} onPointerLeave={stop}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDone(); }} aria-label={`${label} — hold inne for å bekrefte`}>
      <span style={{ position: "absolute", inset: 0, transformOrigin: "left", transform: `scaleX(${p})`, background: "rgba(255,255,255,.18)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>{label}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>Hold</span></span>
    </button>
  );
}

/* ─── Prototype workspace (outside the phone) ───────────────────────────── */
export type ScreenMeta = { id: string; n: string; title: string; group: string; motion: string; haptic?: string };
export type Flow = { label: string; sub: string; start: () => void };

export function Stage({ product, screens, current, onSelect, flows, theme, setTheme, motion, setMotion, haptic, children }: {
  product: string; screens: ScreenMeta[]; current: string; onSelect: (id: string) => void; flows: Flow[];
  theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void; motion: "full" | "reduced"; setMotion: (m: "full" | "reduced") => void;
  haptic: { kind: string; key: number } | null; children: ReactNode;
}) {
  const meta = screens.find((s) => s.id === current);
  const groups = Array.from(new Set(screens.map((s) => s.group)));
  return (
    <div style={{ fontFamily: "Geist, Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a95a3", fontWeight: 600 }}>SNAR 10 · Prototype</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.025em", marginTop: 4 }}>{product}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="s10-seg" role="group" aria-label="Tema">
            <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Lys</button>
            <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Mørk</button>
          </div>
          <div className="s10-seg" role="group" aria-label="Bevegelse">
            <button aria-pressed={motion === "full"} onClick={() => setMotion("full")}>Full motion</button>
            <button aria-pressed={motion === "reduced"} onClick={() => setMotion("reduced")}>Redusert</button>
          </div>
        </div>
      </div>
      <div className="s10-stage">
        <nav className="s10-index" aria-label="Skjermer">
          {groups.map((g) => (
            <div key={g}>
              <h4>{g}</h4>
              {screens.filter((s) => s.group === g).map((s) => (
                <button key={s.id} aria-current={s.id === current} onClick={() => onSelect(s.id)}><span>{s.n}</span><span>{s.title}</span></button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
        <aside className="s10-notes">
          <div className="s10-card">
            <div style={{ fontSize: 11, color: "#8a95a3", fontWeight: 600, letterSpacing: ".08em" }}>SKJERM {meta?.n}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, letterSpacing: "-.015em" }}>{meta?.title}</div>
            <div style={{ marginTop: 14, fontSize: 11, color: "#8a95a3", fontWeight: 600, letterSpacing: ".08em" }}>MOTION</div>
            <p style={{ fontSize: 13, lineHeight: "19px", color: "#33465c", marginTop: 4 }}>{meta?.motion}</p>
            <div style={{ marginTop: 14, fontSize: 11, color: "#8a95a3", fontWeight: 600, letterSpacing: ".08em" }}>HAPTIKK</div>
            <p style={{ fontSize: 13, color: "#33465c", marginTop: 4 }}>{meta?.haptic ?? "Ingen"}</p>
            <div style={{ minHeight: 34, marginTop: 12 }}>{haptic && <span key={haptic.key} className="s10-haptic">● Haptikk · {haptic.kind}</span>}</div>
          </div>
          <div className="s10-card s10-flows">
            <div style={{ fontSize: 11, color: "#8a95a3", fontWeight: 600, letterSpacing: ".08em" }}>PROTOTYPE-FLYTER</div>
            {flows.map((f) => <button key={f.label} onClick={f.start}>{f.label}<small>{f.sub}</small></button>)}
          </div>
          <div className="s10-card" style={{ fontSize: 12, color: "#4b5a6c", lineHeight: "18px" }}>
            <b style={{ color: "#0b1a2c" }}>System</b> · Geist · 4/8 pt · radius 12 / 18 / 24 / 30 · micro 150 ms · komponent 210 ms · ark 280 ms spring (1.32 overshoot) · tabulære tall.
          </div>
        </aside>
      </div>
    </div>
  );
}

export function useProto(initial: string) {
  const [screen, setScreen] = useState(initial);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [motion, setMotion] = useState<"full" | "reduced">("full");
  const [haptic, setHaptic] = useState<{ kind: string; key: number } | null>(null);
  const go = (id: string, h?: string) => { setScreen(id); if (h) setHaptic({ kind: h, key: Date.now() }); };
  return { screen, go, theme, setTheme, motion, setMotion, haptic };
}

/** Animate 0→1 while active. */
export function useProgress(active: boolean, ms: number, onDone?: () => void) {
  const [t, setT] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!active) { setT(0); return; }
    setT(0);
    const steps = Math.max(1, Math.round(ms / 900));
    let i = 0;
    const iv = setInterval(() => {
      i++; setT(i / steps);
      if (i >= steps) { clearInterval(iv); done.current?.(); }
    }, 900);
    return () => clearInterval(iv);
  }, [active, ms]);
  return t;
}
