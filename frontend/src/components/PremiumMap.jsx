import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * PremiumMap — MapLibre GL JS with subtle 3D pitch, extruded buildings,
 * brass polyline, and custom HTML markers for cars/pickup/dropoff.
 *
 * Props:
 *  - center: [lng, lat]           (default Oslo)
 *  - zoom, pitch, bearing
 *  - fitBounds: [[lng,lat], [lng,lat]]   (optional)
 *  - route: GeoJSON LineString coordinates ([[lng,lat],...])
 *  - pickup: {lat, lng} or null
 *  - dropoff: {lat, lng} or null
 *  - cars: [{lat, lng, bearing}]           background/nearby fleet
 *  - activeCar: {lat, lng, bearing}         hero car during trip
 *  - onReady, onMoveEnd, followActive
 */
/* Primary map style: MapTiler dark vector when REACT_APP_MAPTILER_API_KEY is set (enables 3D
   buildings + crisp vector labels). Falls back to a free dark raster when no key or on load error. */
const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_API_KEY || "";
const MAPTILER_STYLE_ID = process.env.REACT_APP_MAPTILER_STYLE || "streets-v2-dark";
const MAPTILER_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`
  : null;

/** Dark Nordic raster fallback — mørk graphite base med KJAPP-gull som subtil aksent */
const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    dark: {
      type: "raster",
      tiles: [
        "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-c.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#06090A" } },
    { id: "dark-layer", type: "raster", source: "dark", paint: { "raster-opacity": 0.95, "raster-brightness-min": 0, "raster-brightness-max": 0.85, "raster-saturation": -0.3 } },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

export default function PremiumMap({
  center = [10.7461, 59.9127],
  zoom = 12,
  pitch = 45,
  bearing = 0,
  fitBounds = null,
  route = null,
  pickup = null,
  dropoff = null,
  cars = [],
  activeCar = null,
  userPos = null,      // {lat, lng} — draws pulsing champagne ring
  followActive = false,
  interactive = true,
  className = "",
  testid = "premium-map",
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAPTILER_STYLE_URL || FALLBACK_RASTER_STYLE,  // MapTiler dark vector when keyed, else free dark raster
      center,
      zoom,
      pitch,
      bearing,
      attributionControl: false,
      interactive,
      hash: false,
    });
    mapRef.current = map;

    // No fallback needed — we're always on the dark raster style
    const swapToFallback = () => { /* noop */ };
    map.on("error", (e) => {
      // Only fallback on style/source load errors (network, CORS)
      const msg = (e?.error?.message || "").toLowerCase();
      if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("style")) {
        swapToFallback();
      }
    });
    // Safety timeout: if style not loaded in 4s, use fallback
    const styleTimeout = setTimeout(() => {
      try {
        if (!map.isStyleLoaded()) swapToFallback();
      } catch { /* ignore */ }
    }, 4000);

    map.on("load", () => {
      clearTimeout(styleTimeout);
      setReady(true);
    });

    // On EVERY style load (initial + fallback swap), add 3D buildings + route layers
    const onStyleLoaded = () => {
      // 3D buildings (only if style has openmaptiles source)
      try {
        if (map.getSource("openmaptiles") && !map.getLayer("3d-buildings")) {
          const layers = map.getStyle().layers || [];
          const labelLayer = layers.find((l) => l.type === "symbol" && l["layout"]?.["text-field"]);
          map.addLayer(
            {
              id: "3d-buildings",
              source: "openmaptiles",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 14,
              paint: {
                "fill-extrusion-color": [
                  "interpolate", ["linear"], ["get", "render_height"],
                  0, "#161D24",
                  60, "#1F2A33",
                  120, "#24303A",
                ],
                "fill-extrusion-height": [
                  "interpolate", ["linear"], ["zoom"],
                  14, 0,
                  15.5, ["coalesce", ["get", "render_height"], 6],
                ],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.82,
              },
            },
            labelLayer?.id,
          );
        }
      } catch { /* ignore */ }

      // Route source + 3 layers (glow / line / shimmer)
      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
        });
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#CBA365", "line-width": 10, "line-opacity": 0.22, "line-blur": 8 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#CBA365", "line-width": 5, "line-opacity": 0.95 },
        });
        map.addLayer({
          id: "route-shimmer",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#F4F4F0", "line-width": 1.4, "line-opacity": 0.9, "line-dasharray": [1, 6] },
        });
      }
    };
    map.on("style.load", onStyleLoaded);

    return () => {
      clearTimeout(styleTimeout);
      Object.values(markersRef.current).forEach((m) => m?.remove?.());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update route data
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const src = map.getSource("route");
    if (!src) return;
    if (route && route.length) {
      src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: route } });
    } else {
      src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] } });
    }
  }, [ready, route]);

  // Animated "energy" flow along the route (ant-path) — premium living brass/ivory shimmer
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.getLayer("route-shimmer")) return;
    if (!(route && route.length)) return;
    const seq = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
      [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
    ];
    let step = 0, raf = 0, last = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 55) return;
      last = t;
      step = (step + 1) % seq.length;
      try { map.setPaintProperty("route-shimmer", "line-dasharray", seq[step]); } catch { /* ignore */ }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, route]);

  // Fit bounds when both pickup & dropoff or fitBounds provided
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    let bounds = null;
    if (fitBounds) bounds = fitBounds;
    else if (pickup && dropoff) bounds = [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]];
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: { top: 100, bottom: 320, left: 60, right: 60 }, pitch, bearing, duration: 900, maxZoom: 15 });
      } catch { /* ignore */ }
    }
  }, [ready, fitBounds, pickup, dropoff, pitch, bearing]);

  // Follow active car (during trip)
  useEffect(() => {
    if (!ready || !followActive || !activeCar || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [activeCar.lng, activeCar.lat],
      duration: 800,
      bearing: activeCar.bearing || 0,
      pitch,
    });
  }, [ready, followActive, activeCar, pitch]);

  // Manage markers — MapLibre markers don't need style-load, they attach to DOM
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const wanted = {};

    if (pickup) {
      wanted["pickup"] = { lng: pickup.lng, lat: pickup.lat, el: pickupEl() };
    }
    if (dropoff) {
      wanted["dropoff"] = { lng: dropoff.lng, lat: dropoff.lat, el: dropoffEl() };
    }
    if (userPos) {
      wanted["user"] = { lng: userPos.lng, lat: userPos.lat, el: userPosEl() };
    }
    cars.forEach((c, i) => {
      wanted[`nearby-${i}`] = { lng: c.lng, lat: c.lat, el: carEl(c.bearing || 0, false) };
    });
    if (activeCar) {
      wanted["active"] = { lng: activeCar.lng, lat: activeCar.lat, el: carEl(activeCar.bearing || 0, true) };
    }

    // Remove stale
    Object.keys(markersRef.current).forEach((k) => {
      if (!wanted[k]) {
        markersRef.current[k].remove();
        delete markersRef.current[k];
      }
    });
    // Add/move
    Object.entries(wanted).forEach(([k, v]) => {
      if (markersRef.current[k]) {
        markersRef.current[k].setLngLat([v.lng, v.lat]);
        // If active car, update inner rotation
        if (k === "active" || k.startsWith("nearby-")) {
          const inner = markersRef.current[k].getElement().querySelector(".car-rotate");
          if (inner) inner.style.transform = `rotate(${(k === "active" ? activeCar.bearing : cars[parseInt(k.split("-")[1], 10)]?.bearing) || 0}deg)`;
        }
      } else {
        const m = new MapLibreMarker({ element: v.el, anchor: (k === "pickup" || k === "dropoff") ? "bottom" : "center" })
          .setLngLat([v.lng, v.lat])
          .addTo(map);
        markersRef.current[k] = m;
      }
    });
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, userPos?.lat, userPos?.lng, cars, activeCar?.lat, activeCar?.lng, activeCar?.bearing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative w-full h-full ${className}`} data-testid={testid} style={{ minHeight: 200 }}>
      <div ref={mapContainer} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* Overlay gradient at the top for chip readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: "linear-gradient(to bottom, rgba(12,18,22,0.55), transparent)" }} />
      {/* Zoom controls — brass, top-right */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[10]">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom inn"
          data-testid="map-zoom-in"
          className="w-10 h-10 rounded-2xl grid place-items-center backdrop-blur-xl transition-transform active:scale-95"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(201,161,91,0.35)", color: "var(--accent)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom ut"
          data-testid="map-zoom-out"
          className="w-10 h-10 rounded-2xl grid place-items-center backdrop-blur-xl transition-transform active:scale-95"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(201,161,91,0.35)", color: "var(--accent)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ================= Marker DOM builders (kept outside React tree) ================= */

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function pickupEl() {
  return el(`
    <div style="pointer-events:none; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.5));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46">
        <defs>
          <linearGradient id="pinG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e0b876"/>
            <stop offset="100%" stop-color="#a8834a"/>
          </linearGradient>
        </defs>
        <ellipse cx="18" cy="42" rx="6.5" ry="2" fill="#000" opacity="0.35"/>
        <path d="M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z" fill="url(#pinG)" stroke="#F4F4F0" stroke-opacity="0.6" stroke-width="1.5"/>
        <circle cx="18" cy="17" r="6.2" fill="#0B1013"/>
        <circle cx="18" cy="17" r="2.6" fill="#F4F4F0"/>
      </svg>
    </div>
  `);
}

/** Elegant pulsing user location — champagne ring on graphite */
function userPosEl() {
  return el(`
    <div style="pointer-events:none; position:relative; width:44px; height:44px;">
      <div style="position:absolute; inset:0; border-radius:50%; background:rgba(203,163,101,0.28); animation: kjapp-pulse-1 2.6s ease-out infinite;"></div>
      <div style="position:absolute; inset:8px; border-radius:50%; background:rgba(203,163,101,0.55); border:1px solid rgba(203,163,101,0.9);"></div>
      <div style="position:absolute; inset:16px; border-radius:50%; background:#F4F4F0; box-shadow:0 0 8px rgba(203,163,101,0.9);"></div>
      <style>@keyframes kjapp-pulse-1 { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }</style>
    </div>
  `);
}

function dropoffEl() {
  return el(`
    <div style="pointer-events:none; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.5));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46">
        <ellipse cx="18" cy="42" rx="6" ry="2" fill="#000" opacity="0.35"/>
        <path d="M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z" fill="#0B1013" stroke="#CBA365" stroke-width="1.8"/>
        <g transform="translate(12 10)">
          <rect x="0" y="0" width="3" height="3" fill="#F4F4F0"/><rect x="3" y="0" width="3" height="3" fill="#CBA365"/><rect x="6" y="0" width="3" height="3" fill="#F4F4F0"/><rect x="9" y="0" width="3" height="3" fill="#CBA365"/>
          <rect x="0" y="3" width="3" height="3" fill="#CBA365"/><rect x="3" y="3" width="3" height="3" fill="#F4F4F0"/><rect x="6" y="3" width="3" height="3" fill="#CBA365"/><rect x="9" y="3" width="3" height="3" fill="#F4F4F0"/>
          <rect x="0" y="6" width="3" height="3" fill="#F4F4F0"/><rect x="3" y="6" width="3" height="3" fill="#CBA365"/><rect x="6" y="6" width="3" height="3" fill="#F4F4F0"/><rect x="9" y="6" width="3" height="3" fill="#CBA365"/>
        </g>
      </svg>
    </div>
  `);
}

/** Premium car sprite — subtle gold halo for all available cars (identity marker) */
function carEl(bearing = 0, active = false) {
  const glow = active ? "0 10px 20px rgba(203,163,101,0.65)" : "0 4px 10px rgba(203,163,101,0.28)";
  const scale = active ? 1.15 : 1.0;
  const halo = `<circle cx="26" cy="26" r="${active ? 22 : 18}" fill="url(#carHalo)" opacity="${active ? 1 : 0.55}"/>`;
  return el(`
    <div class="premium-car" style="pointer-events:none; width:52px; height:52px;">
      <div class="car-rotate" style="width:100%; height:100%; transform: rotate(${bearing}deg); transition: transform 0.5s ease; filter: drop-shadow(${glow}); transform-origin: 50% 50%;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="52" height="52">
          <defs>
            <radialGradient id="carHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#CBA365" stop-opacity="0.45"/>
              <stop offset="70%" stop-color="#CBA365" stop-opacity="0.05"/>
              <stop offset="100%" stop-color="#CBA365" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2b2f36"/>
              <stop offset="50%" stop-color="#171a1e"/>
              <stop offset="100%" stop-color="#0e1013"/>
            </linearGradient>
            <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3a4048"/>
              <stop offset="100%" stop-color="#1c2026"/>
            </linearGradient>
            <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#CBA365" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#CBA365" stop-opacity="0.5"/>
            </linearGradient>
          </defs>
          ${halo}
          <g transform="translate(26 26) scale(${scale})">
            <!-- ground shadow -->
            <ellipse cx="1" cy="2" rx="8" ry="13" fill="#000" opacity="0.4"/>
            <!-- body silhouette (isometric-lite) -->
            <path d="M -7 -13 Q -7 -15 -5 -15 L 5 -15 Q 7 -15 7 -13 L 7 13 Q 7 15 5 15 L -5 15 Q -7 15 -7 13 Z" fill="url(#body)" stroke="#CBA365" stroke-width="1.2"/>
            <!-- roof panel -->
            <rect x="-5.6" y="-8" width="11.2" height="14" rx="1.4" fill="url(#roof)"/>
            <!-- windshield -->
            <path d="M -5 -11.5 Q -5 -13 -3.4 -13 L 3.4 -13 Q 5 -13 5 -11.5 L 5 -6.5 L -5 -6.5 Z" fill="url(#glass)"/>
            <!-- rear window -->
            <path d="M -5 6 L 5 6 L 5 11.5 Q 5 13 3.4 13 L -3.4 13 Q -5 13 -5 11.5 Z" fill="url(#glass)" opacity="0.6"/>
            <!-- side lines (metallic highlight) -->
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#ffffff" stroke-opacity="0.05" stroke-width="0.5"/>
            <!-- headlights (front) -->
            <ellipse cx="-3.8" cy="-13.7" rx="1.2" ry="0.6" fill="#fff9e8"/>
            <ellipse cx="3.8" cy="-13.7" rx="1.2" ry="0.6" fill="#fff9e8"/>
            <!-- headlight glow (only for active) -->
            ${active ? '<ellipse cx="0" cy="-19" rx="10" ry="6" fill="#fff9e8" opacity="0.10"/>' : ''}
            <!-- taillights -->
            <rect x="-4.6" y="13.2" width="1.6" height="1" rx="0.4" fill="#d76a5a"/>
            <rect x="3" y="13.2" width="1.6" height="1" rx="0.4" fill="#d76a5a"/>
          </g>
        </svg>
      </div>
    </div>
  `);
}

/* Also expose a driver-side variant (mint) if needed */
export function driverCarEl(bearing = 0) {
  return el(`
    <div style="pointer-events:none; width:52px; height:52px;">
      <div style="width:100%; height:100%; transform: rotate(${bearing}deg); transition: transform 0.5s ease; filter: drop-shadow(0 8px 16px rgba(47,224,140,0.5));">
        <svg viewBox="0 0 52 52" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(26 26)">
            <ellipse cx="1" cy="2" rx="8" ry="13" fill="#000" opacity="0.4"/>
            <path d="M -7 -13 Q -7 -15 -5 -15 L 5 -15 Q 7 -15 7 -13 L 7 13 Q 7 15 5 15 L -5 15 Q -7 15 -7 13 Z" fill="#0d0f11" stroke="#2fe08c" stroke-width="1.3"/>
            <rect x="-5.6" y="-8" width="11.2" height="14" rx="1.4" fill="#1a1e22"/>
            <path d="M -5 -11.5 Q -5 -13 -3.4 -13 L 3.4 -13 Q 5 -13 5 -11.5 L 5 -6.5 L -5 -6.5 Z" fill="#2fe08c" opacity="0.7"/>
            <path d="M -5 6 L 5 6 L 5 11.5 Q 5 13 3.4 13 L -3.4 13 Q -5 13 -5 11.5 Z" fill="#2fe08c" opacity="0.5"/>
          </g>
        </svg>
      </div>
    </div>
  `);
}
