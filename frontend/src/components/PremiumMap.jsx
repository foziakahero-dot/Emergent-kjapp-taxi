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
/* Primary: OpenFreeMap Liberty (vector, has buildings). Fallback: raster OSM. */
const STYLE_URLS = {
  primary: "https://tiles.openfreemap.org/styles/liberty",
};

/** Minimal raster fallback style — 100% free, no key */
const FALLBACK_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#f4ecd8" } },
    { id: "osm-layer", type: "raster", source: "osm" },
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
      style: STYLE_URLS.primary,
      center,
      zoom,
      pitch,
      bearing,
      attributionControl: false,
      interactive,
      hash: false,
    });
    mapRef.current = map;

    // If the primary vector style fails to load (network / block), swap to raster
    let fallbackApplied = false;
    const swapToFallback = () => {
      if (fallbackApplied) return;
      fallbackApplied = true;
      try { map.setStyle(FALLBACK_RASTER_STYLE); } catch { /* ignore */ }
    };
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
                  0, "#1a2027",
                  50, "#232c34",
                  120, "#2e3841",
                ],
                "fill-extrusion-height": [
                  "interpolate", ["linear"], ["zoom"],
                  14, 0,
                  15.5, ["coalesce", ["get", "render_height"], 6],
                ],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.75,
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
          paint: { "line-color": "#c9a15b", "line-width": 10, "line-opacity": 0.18, "line-blur": 6 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#c9a15b", "line-width": 5, "line-opacity": 0.95 },
        });
        map.addLayer({
          id: "route-shimmer",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f4ecd8", "line-width": 1.4, "line-opacity": 0.9, "line-dasharray": [1, 6] },
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

  // Manage markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const wanted = {};

    if (pickup) {
      wanted["pickup"] = { lng: pickup.lng, lat: pickup.lat, el: pickupEl() };
    }
    if (dropoff) {
      wanted["dropoff"] = { lng: dropoff.lng, lat: dropoff.lat, el: dropoffEl() };
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
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, cars, activeCar?.lat, activeCar?.lng, activeCar?.bearing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative w-full h-full ${className}`} data-testid={testid} style={{ minHeight: 200 }}>
      <div ref={mapContainer} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* Overlay gradient at the top for chip readability */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: "linear-gradient(to bottom, rgba(12,18,22,0.55), transparent)" }} />
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
        <path d="M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z" fill="url(#pinG)" stroke="#f4ecd8" stroke-opacity="0.6" stroke-width="1.5"/>
        <circle cx="18" cy="17" r="6.2" fill="#0c1216"/>
        <circle cx="18" cy="17" r="2.6" fill="#f4ecd8"/>
      </svg>
    </div>
  `);
}

function dropoffEl() {
  return el(`
    <div style="pointer-events:none; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.5));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46">
        <ellipse cx="18" cy="42" rx="6" ry="2" fill="#000" opacity="0.35"/>
        <path d="M 18 2 C 9.7 2 3 8.7 3 17 c 0 10.2 12.5 22.5 14.2 24.1 a 1.1 1.1 0 0 0 1.6 0 C 20.5 39.5 33 27.2 33 17 C 33 8.7 26.3 2 18 2 Z" fill="#0c1216" stroke="#c9a15b" stroke-width="1.8"/>
        <g transform="translate(12 10)">
          <rect x="0" y="0" width="3" height="3" fill="#f4ecd8"/><rect x="3" y="0" width="3" height="3" fill="#c9a15b"/><rect x="6" y="0" width="3" height="3" fill="#f4ecd8"/><rect x="9" y="0" width="3" height="3" fill="#c9a15b"/>
          <rect x="0" y="3" width="3" height="3" fill="#c9a15b"/><rect x="3" y="3" width="3" height="3" fill="#f4ecd8"/><rect x="6" y="3" width="3" height="3" fill="#c9a15b"/><rect x="9" y="3" width="3" height="3" fill="#f4ecd8"/>
          <rect x="0" y="6" width="3" height="3" fill="#f4ecd8"/><rect x="3" y="6" width="3" height="3" fill="#c9a15b"/><rect x="6" y="6" width="3" height="3" fill="#f4ecd8"/><rect x="9" y="6" width="3" height="3" fill="#c9a15b"/>
        </g>
      </svg>
    </div>
  `);
}

/** Premium 3D-ish car sprite (isometric perspective) */
function carEl(bearing = 0, active = false) {
  const glow = active ? "0 8px 16px rgba(201,161,91,0.55)" : "0 4px 8px rgba(0,0,0,0.35)";
  const scale = active ? 1.15 : 1.0;
  const halo = active ? `<circle cx="26" cy="26" r="22" fill="url(#carHalo)"/>` : "";
  return el(`
    <div class="premium-car" style="pointer-events:none; width:52px; height:52px;">
      <div class="car-rotate" style="width:100%; height:100%; transform: rotate(${bearing}deg); transition: transform 0.5s ease; filter: drop-shadow(${glow}); transform-origin: 50% 50%;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="52" height="52">
          <defs>
            <radialGradient id="carHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#c9a15b" stop-opacity="0.45"/>
              <stop offset="70%" stop-color="#c9a15b" stop-opacity="0.05"/>
              <stop offset="100%" stop-color="#c9a15b" stop-opacity="0"/>
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
              <stop offset="0%" stop-color="#c9a15b" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="#c9a15b" stop-opacity="0.5"/>
            </linearGradient>
          </defs>
          ${halo}
          <g transform="translate(26 26) scale(${scale})">
            <!-- ground shadow -->
            <ellipse cx="1" cy="2" rx="8" ry="13" fill="#000" opacity="0.4"/>
            <!-- body silhouette (isometric-lite) -->
            <path d="M -7 -13 Q -7 -15 -5 -15 L 5 -15 Q 7 -15 7 -13 L 7 13 Q 7 15 5 15 L -5 15 Q -7 15 -7 13 Z" fill="url(#body)" stroke="#c9a15b" stroke-width="1.2"/>
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
