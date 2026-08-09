import L from "leaflet";

// Mint premium car marker (top-down view, minimal)
const CAR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'>
  <defs>
    <radialGradient id='g' cx='50%25' cy='50%25' r='50%25'>
      <stop offset='0%25' stop-color='%233dffa2' stop-opacity='0.5'/>
      <stop offset='60%25' stop-color='%232fe08c' stop-opacity='0.2'/>
      <stop offset='100%25' stop-color='%232fe08c' stop-opacity='0'/>
    </radialGradient>
  </defs>
  <circle cx='20' cy='20' r='19' fill='url(%23g)'/>
  <g transform='translate(20 20)'>
    <!-- car body top-down -->
    <path d='M -6 -10 Q -6 -12 -4 -12 L 4 -12 Q 6 -12 6 -10 L 6 10 Q 6 12 4 12 L -4 12 Q -6 12 -6 10 Z' fill='%230e1113' stroke='%232fe08c' stroke-width='1.4'/>
    <!-- windshield -->
    <path d='M -4.5 -9 Q -4.5 -10 -3 -10 L 3 -10 Q 4.5 -10 4.5 -9 L 4.5 -3 L -4.5 -3 Z' fill='%232fe08c' fill-opacity='0.35'/>
    <!-- rear window -->
    <path d='M -4.5 3 L 4.5 3 L 4.5 9 Q 4.5 10 3 10 L -3 10 Q -4.5 10 -4.5 9 Z' fill='%232fe08c' fill-opacity='0.2'/>
    <!-- headlights -->
    <circle cx='-3.6' cy='-11' r='0.8' fill='%23ffffff'/>
    <circle cx='3.6' cy='-11' r='0.8' fill='%23ffffff'/>
  </g>
</svg>`;

// Passenger pickup marker — mint dot with pulse
const PICKUP_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'>
  <circle cx='16' cy='16' r='15' fill='%232fe08c' opacity='0.15'/>
  <circle cx='16' cy='16' r='9' fill='%232fe08c' opacity='0.3'/>
  <circle cx='16' cy='16' r='5' fill='%232fe08c' stroke='%23050708' stroke-width='2'/>
</svg>`;

// Dropoff — white square pin
const DROPOFF_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' width='28' height='28'>
  <rect x='6' y='6' width='16' height='16' rx='3' fill='%23ffffff' stroke='%23050708' stroke-width='2'/>
  <rect x='10' y='10' width='8' height='8' rx='1' fill='%23050708'/>
</svg>`;

// Available fleet car — smaller mint version
const FLEET_CAR_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' width='28' height='28'>
  <circle cx='14' cy='14' r='13' fill='%232fe08c' opacity='0.12'/>
  <g transform='translate(14 14) scale(0.6)'>
    <path d='M -6 -10 Q -6 -12 -4 -12 L 4 -12 Q 6 -12 6 -10 L 6 10 Q 6 12 4 12 L -4 12 Q -6 12 -6 10 Z' fill='%230e1113' stroke='%232fe08c' stroke-width='1.6'/>
    <path d='M -4.5 -9 Q -4.5 -10 -3 -10 L 3 -10 Q 4.5 -10 4.5 -9 L 4.5 -3 L -4.5 -3 Z' fill='%232fe08c' fill-opacity='0.4'/>
    <path d='M -4.5 3 L 4.5 3 L 4.5 9 Q 4.5 10 3 10 L -3 10 Q -4.5 10 -4.5 9 Z' fill='%232fe08c' fill-opacity='0.25'/>
  </g>
</svg>`;

export const pickupIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter:drop-shadow(0 0 10px rgba(47,224,140,0.6))">${decodeURIComponent(PICKUP_SVG)}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export const dropoffIcon = L.divIcon({
  className: "kjapp-marker",
  html: decodeURIComponent(DROPOFF_SVG),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const carIcon = L.divIcon({
  className: "kjapp-marker",
  html: `<div style="filter:drop-shadow(0 0 12px rgba(47,224,140,0.5))">${decodeURIComponent(CAR_SVG)}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export const fleetCarIcon = L.divIcon({
  className: "kjapp-marker",
  html: decodeURIComponent(FLEET_CAR_SVG),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/** Build a car icon rotated to face the direction of travel (bearing in degrees). */
export function carIconRotated(bearing = 0) {
  return L.divIcon({
    className: "kjapp-marker",
    html: `<div style="transform:rotate(${bearing}deg);transition:transform 0.5s ease;filter:drop-shadow(0 0 12px rgba(47,224,140,0.55))">${decodeURIComponent(CAR_SVG)}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/**
 * Open native maps app for turn-by-turn navigation.
 * Works on Android (Google Maps app), iOS (Google Maps app if installed, else Apple Maps).
 */
export function openMapsNavigation(lat, lng, label = "") {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // Google Maps universal URL (works on Android, iOS, and web)
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  if (isIOS) {
    // On iOS, try to open Google Maps app via comgooglemaps:// scheme first, fallback to universal URL
    const cg = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
    const t = Date.now();
    window.location.href = cg;
    // fallback after 800ms if Google Maps app not installed → universal URL will use browser or Apple Maps
    setTimeout(() => {
      if (Date.now() - t < 1600) window.location.href = gmapsUrl;
    }, 800);
  } else {
    // Android + desktop: universal Google Maps URL opens app on Android via intent
    window.location.href = gmapsUrl;
  }
}
