import L from "leaflet";

/* ============================================================
   KJAPP Nordic Premium — Map iconography
   Customer accent: varm messing #c9a15b (default)
   Driver accent: skarp mint #2fe08c (used only when driver-theme)
   ============================================================ */

const BRASS = "#c9a15b";
const BRASS_SOFT = "rgba(201, 161, 91, 0.35)";
const BRASS_GLOW = "rgba(201, 161, 91, 0.55)";
const INK = "#0c1216";      /* fjordsvart */
const CREAM = "#f4ecd8";    /* svak kremhvit for glass */
const MINT = "#2fe08c";     /* driver-siden */

/* ----- Car marker (top-down premium sedan silhouette) ----- */
function carSVG(bodyColor = "#171a1e", accent = BRASS, accentSoft = BRASS_SOFT) {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44' width='44' height='44'>
    <defs>
      <radialGradient id='halo' cx='50%25' cy='50%25' r='50%25'>
        <stop offset='0%25' stop-color='${encodeURIComponent(accent)}' stop-opacity='0.35'/>
        <stop offset='70%25' stop-color='${encodeURIComponent(accent)}' stop-opacity='0.05'/>
        <stop offset='100%25' stop-color='${encodeURIComponent(accent)}' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <circle cx='22' cy='22' r='21' fill='url(%23halo)'/>
    <g transform='translate(22 22)'>
      <!-- shadow -->
      <ellipse cx='0.4' cy='1' rx='7.5' ry='11.5' fill='%23000' opacity='0.35'/>
      <!-- body -->
      <path d='M -6.4 -11.2 Q -6.4 -13 -4.6 -13 L 4.6 -13 Q 6.4 -13 6.4 -11.2 L 6.4 11.2 Q 6.4 13 4.6 13 L -4.6 13 Q -6.4 13 -6.4 11.2 Z' fill='${encodeURIComponent(bodyColor)}' stroke='${encodeURIComponent(accent)}' stroke-width='1.3'/>
      <!-- roof (subtle highlight) -->
      <path d='M -5.4 -6 L 5.4 -6 L 5.4 4 L -5.4 4 Z' fill='%23ffffff' fill-opacity='0.03'/>
      <!-- windshield -->
      <path d='M -4.5 -9.5 Q -4.5 -10.5 -3 -10.5 L 3 -10.5 Q 4.5 -10.5 4.5 -9.5 L 4.5 -4 L -4.5 -4 Z' fill='${encodeURIComponent(accent)}' fill-opacity='0.55'/>
      <!-- rear window -->
      <path d='M -4.5 3.6 L 4.5 3.6 L 4.5 9.5 Q 4.5 10.5 3 10.5 L -3 10.5 Q -4.5 10.5 -4.5 9.5 Z' fill='${encodeURIComponent(accent)}' fill-opacity='0.30'/>
      <!-- headlights -->
      <ellipse cx='-3.6' cy='-11.6' rx='1.1' ry='0.55' fill='%23fff9e8'/>
      <ellipse cx='3.6' cy='-11.6' rx='1.1' ry='0.55' fill='%23fff9e8'/>
      <!-- taillights -->
      <rect x='-4.4' y='11.3' width='1.5' height='0.9' rx='0.3' fill='%23d76a5a'/>
      <rect x='2.9' y='11.3' width='1.5' height='0.9' rx='0.3' fill='%23d76a5a'/>
    </g>
  </svg>`;
}

/* ----- Passenger PICKUP marker — brass droplet pin ----- */
const PICKUP_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 46' width='36' height='46'>
  <defs>
    <linearGradient id='pinG' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%25' stop-color='%23e0b876'/>
      <stop offset='100%25' stop-color='%23a8834a'/>
    </linearGradient>
  </defs>
  <!-- shadow -->
  <ellipse cx='18' cy='42' rx='6.5' ry='2' fill='%23000' opacity='0.35'/>
  <!-- pin body -->
  <path d='M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z' fill='url(%23pinG)' stroke='%23f4ecd8' stroke-width='1.5' stroke-opacity='0.6'/>
  <!-- inner dot -->
  <circle cx='18' cy='17' r='6.2' fill='%230c1216'/>
  <circle cx='18' cy='17' r='2.6' fill='%23f4ecd8'/>
</svg>`;

/* ----- DROPOFF — dark checkered flag pin ----- */
const DROPOFF_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 46' width='36' height='46'>
  <!-- shadow -->
  <ellipse cx='18' cy='42' rx='6' ry='2' fill='%23000' opacity='0.35'/>
  <!-- pin body -->
  <path d='M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z' fill='%230c1216' stroke='%23c9a15b' stroke-width='1.8'/>
  <!-- checker flag -->
  <g transform='translate(12 10)'>
    <rect x='0' y='0' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='3' y='0' width='3' height='3' fill='%23c9a15b'/>
    <rect x='6' y='0' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='9' y='0' width='3' height='3' fill='%23c9a15b'/>
    <rect x='0' y='3' width='3' height='3' fill='%23c9a15b'/>
    <rect x='3' y='3' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='6' y='3' width='3' height='3' fill='%23c9a15b'/>
    <rect x='9' y='3' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='0' y='6' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='3' y='6' width='3' height='3' fill='%23c9a15b'/>
    <rect x='6' y='6' width='3' height='3' fill='%23f4ecd8'/>
    <rect x='9' y='6' width='3' height='3' fill='%23c9a15b'/>
  </g>
</svg>`;

/* ----- Available fleet cars in nearby view (smaller, subtle brass) ----- */
const FLEET_CAR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'>
  <defs>
    <radialGradient id='fh' cx='50%25' cy='50%25' r='50%25'>
      <stop offset='0%25' stop-color='%23c9a15b' stop-opacity='0.30'/>
      <stop offset='100%25' stop-color='%23c9a15b' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <circle cx='16' cy='16' r='15' fill='url(%23fh)'/>
  <g transform='translate(16 16) scale(0.62)'>
    <path d='M -6.4 -11.2 Q -6.4 -13 -4.6 -13 L 4.6 -13 Q 6.4 -13 6.4 -11.2 L 6.4 11.2 Q 6.4 13 4.6 13 L -4.6 13 Q -6.4 13 -6.4 11.2 Z' fill='%23171a1e' stroke='%23c9a15b' stroke-width='1.6'/>
    <path d='M -4.5 -9.5 Q -4.5 -10.5 -3 -10.5 L 3 -10.5 Q 4.5 -10.5 4.5 -9.5 L 4.5 -4 L -4.5 -4 Z' fill='%23c9a15b' fill-opacity='0.55'/>
    <path d='M -4.5 3.6 L 4.5 3.6 L 4.5 9.5 Q 4.5 10.5 3 10.5 L -3 10.5 Q -4.5 10.5 -4.5 9.5 Z' fill='%23c9a15b' fill-opacity='0.30'/>
  </g>
</svg>`;

export const pickupIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter: drop-shadow(0 6px 8px rgba(0,0,0,0.35))">${decodeURIComponent(PICKUP_SVG)}</div>`,
  iconSize: [36, 46],
  iconAnchor: [18, 42],
});

export const dropoffIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter: drop-shadow(0 6px 8px rgba(0,0,0,0.35))">${decodeURIComponent(DROPOFF_SVG)}</div>`,
  iconSize: [36, 46],
  iconAnchor: [18, 42],
});

export const carIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter: drop-shadow(0 6px 10px rgba(201,161,91,0.35))">${decodeURIComponent(carSVG())}</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

export const fleetCarIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25))">${decodeURIComponent(FLEET_CAR_SVG)}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

/** Build a car icon rotated to face the direction of travel (bearing in degrees). */
export function carIconRotated(bearing = 0) {
  return L.divIcon({
    className: "kjapp-marker",
    html: `<div style="transform: rotate(${bearing}deg); transition: transform 0.6s ease; filter: drop-shadow(0 6px 10px rgba(201,161,91,0.45))">${decodeURIComponent(carSVG())}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/** Driver-side rotated car (mint glow) — used only inside driver-theme */
export function carIconRotatedDriver(bearing = 0) {
  return L.divIcon({
    className: "kjapp-marker",
    html: `<div style="transform: rotate(${bearing}deg); transition: transform 0.6s ease; filter: drop-shadow(0 6px 10px rgba(47,224,140,0.45))">${decodeURIComponent(carSVG("#0d0f11", MINT, "rgba(47,224,140,0.35)"))}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Open native maps app for turn-by-turn navigation.
 * Works on Android (Google Maps app), iOS (Google Maps app if installed, else Apple Maps).
 */
export function openMapsNavigation(lat, lng, label = "") {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (isIOS) {
    const cg = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    const t = Date.now();
    window.location.href = cg;
    setTimeout(() => {
      if (Date.now() - t < 1600) window.location.href = gmapsUrl;
    }, 800);
  } else {
    window.location.href = gmapsUrl;
  }
}
