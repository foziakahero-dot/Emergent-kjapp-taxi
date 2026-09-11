import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MapLibreMap, Marker as MapLibreMarker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// The bundled build cannot resolve MapLibre's module worker via import.meta.url (webpack), so the
// worker + shared chunk are copied to /public/maplibre (see package.json "sync-map-worker").
setWorkerUrl(`${process.env.PUBLIC_URL || ""}/maplibre/maplibre-gl-worker.mjs`);

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
/* Map style strategy (no API key required):
   1. MapTiler dark vector when REACT_APP_MAPTILER_API_KEY is set.
   2. OpenFreeMap "dark" vector (free, no key, OpenMapTiles schema → 3D buildings) recolored to the
      KJAPP "Fjord & Granite" palette.
   3. Last resort: OSM raster darkened (CARTO free tiles now watermark "API KEY REQUIRED"). */
const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_API_KEY || "";
const MAPTILER_STYLE_ID = process.env.REACT_APP_MAPTILER_STYLE || "streets-v2-dark";
const MAPTILER_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`
  : null;
const OFM_DARK_URL = "https://tiles.openfreemap.org/styles/dark";

const MAP_BG = "#070B0E";

/** Instant graphite canvas shown while the vector style streams in */
const BASE_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": MAP_BG } }],
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
};

const RASTER_FALLBACK_STYLE = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": MAP_BG } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.55, "raster-brightness-max": 0.32, "raster-saturation": -0.85, "raster-contrast": 0.25 } },
  ],
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
};

/** Fjord & Granite recolor of the OpenFreeMap dark style */
const NORDIC_PAINT = {
  background: { "background-color": MAP_BG },
  water: { "fill-color": "#0B171F" },
  waterway: { "line-color": "#102029" },
  water_name: { "text-color": "#3F5966", "text-halo-color": MAP_BG },
  landcover_ice_shelf: { "fill-color": "#0A1013" },
  landcover_glacier: { "fill-color": "#0A1013" },
  landuse_residential: { "fill-color": "#0A1114" },
  landcover_wood: { "fill-color": "#0C1619" },
  landuse_park: { "fill-color": "#0D181B" },
  building: { "fill-color": "#10181D", "fill-outline-color": "#1B252B" },
  "aeroway-taxiway": { "line-color": "#151D22" },
  "aeroway-runway-casing": { "line-color": "#242E36" },
  "aeroway-area": { "fill-color": "#0B1115" },
  "aeroway-runway": { "line-color": "#0B1115" },
  road_area_pier: { "fill-color": "#0B1216" },
  road_pier: { "line-color": "#0B1216" },
  highway_path: { "line-color": "#141C21" },
  highway_minor: { "line-color": "#1B252B" },
  highway_major_casing: { "line-color": "#2D3841" },
  highway_major_inner: { "line-color": "#1F2931" },
  highway_major_subtle: { "line-color": "#1F2931" },
  highway_motorway_casing: { "line-color": "#3A4550" },
  highway_motorway_inner: { "line-color": "#29333C" },
  highway_motorway_subtle: { "line-color": "#1F2931" },
  railway_transit: { "line-color": "#19222A" },
  railway_transit_dashline: { "line-color": "#0B1216" },
  railway_minor: { "line-color": "#19222A" },
  railway_minor_dashline: { "line-color": "#0B1216" },
  railway: { "line-color": "#19222A" },
  railway_dashline: { "line-color": "#0B1216" },
  highway_name_other: { "text-color": "#6F7B85", "text-halo-color": MAP_BG },
  highway_name_motorway: { "text-color": "#7E8993" },
  boundary_state: { "line-color": "#1F2930" },
  "boundary_country_z0-4": { "line-color": "#242E36" },
  "boundary_country_z5-": { "line-color": "#242E36" },
};

function nordicize(style) {
  const s = JSON.parse(JSON.stringify(style));
  s.layers = (s.layers || []).map((l) => {
    let p = NORDIC_PAINT[l.id];
    if (!p && l.id.startsWith("place_")) {
      const big = l.id === "place_city" || l.id === "place_city_large";
      p = { "text-color": big ? "#D6DBDF" : "#96A1AA", "text-halo-color": "rgba(7,11,14,0.9)" };
    }
    if (p) l.paint = { ...(l.paint || {}), ...p };
    return l;
  });
  return s;
}

async function fetchNordicStyle() {
  const r = await fetch(OFM_DARK_URL);
  if (!r.ok) throw new Error(`style ${r.status}`);
  return nordicize(await r.json());
}

export default function PremiumMap({
  center = [10.7461, 59.9127],
  zoom = 12,
  pitch = 45,
  bearing = 0,
  fitBounds = null,
  route = null,
  heat = null,         // [{lat, lng, weight}] — real demand cells, gold heatmap
  pickup = null,
  dropoff = null,
  cars = [],
  activeCar = null,
  userPos = null,      // {lat, lng} — draws pulsing champagne ring
  followActive = false,
  paddingBottom = 0,   // px covered by UI (bottom sheet) — keeps the visual center in the visible area
  interactive = true,
  className = "",
  testid = "premium-map",
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeRef = useRef(null);
  const heatRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [styleGen, setStyleGen] = useState(0);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: BASE_STYLE,
      center,
      zoom,
      pitch,
      bearing,
      attributionControl: false,
      interactive,
      hash: false,
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") window.__kjappMap = map;

    let disposed = false;
    let usingMapTiler = false;
    const applyNordic = () =>
      fetchNordicStyle()
        .then((st) => { if (!disposed) map.setStyle(st); })
        .catch(() => { if (!disposed) map.setStyle(RASTER_FALLBACK_STYLE); });

    if (MAPTILER_STYLE_URL) {
      usingMapTiler = true;
      map.setStyle(MAPTILER_STYLE_URL);
    } else {
      applyNordic();
    }

    // MapTiler key invalid/quota exceeded → swap to the free Nordic vector style
    map.on("error", (e) => {
      if (process.env.NODE_ENV !== "production") console.warn("[PremiumMap]", e?.error?.message || e);
      if (!usingMapTiler) return;
      const msg = (e?.error?.message || "").toLowerCase();
      const status = e?.error?.status;
      if (status === 401 || status === 403 || msg.includes("style") || msg.includes("failed to fetch")) {
        usingMapTiler = false;
        applyNordic();
      }
    });

    map.on("load", () => setReady(true));

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
                  "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0],
                  0, "#131B21",
                  40, "#1C262E",
                  90, "#28343F",
                  160, "#33414D",
                ],
                "fill-extrusion-height": [
                  "interpolate", ["linear"], ["zoom"],
                  14, 0,
                  15.5, ["coalesce", ["get", "render_height"], 6],
                ],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.88,
              },
            },
            labelLayer?.id,
          );
        }
      } catch { /* ignore */ }

      // Demand heatmap (added BEFORE the route so the route always draws on top)
      if (!map.getSource("demand")) {
        map.addSource("demand", {
          type: "geojson",
          data: { type: "FeatureCollection", features: heatRef.current || [] },
        });
        map.addLayer({
          id: "demand-core",
          type: "circle",
          source: "demand",
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              10, ["*", 14, ["+", 0.6, ["get", "w"]]],
              13, ["*", 30, ["+", 0.6, ["get", "w"]]],
              16, ["*", 70, ["+", 0.6, ["get", "w"]]],
            ],
            "circle-color": "#CBA365",
            "circle-opacity": ["*", 0.26, ["+", 0.45, ["get", "w"]]],
            "circle-blur": 1.15,
          },
        });
        map.addLayer({
          id: "demand-heat",
          type: "heatmap",
          source: "demand",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "w"], 0, 0.35, 1, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 2.2, 13, 3.6, 16, 5],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(203,163,101,0)",
              0.06, "rgba(203,163,101,0.26)",
              0.2, "rgba(219,178,110,0.44)",
              0.45, "rgba(236,203,140,0.6)",
              0.75, "rgba(248,223,168,0.72)",
              1, "rgba(255,240,205,0.85)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 30, 12, 68, 16, 130],
            "heatmap-opacity": 0.92,
          },
        });
      }

      // Route source + 3 layers (glow / line / shimmer) — re-added after every style swap
      if (!map.getSource("route")) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: routeRef.current || [] } },
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
      setStyleGen((g) => g + 1);
    };
    map.on("style.load", onStyleLoaded);

    return () => {
      disposed = true;
      Object.values(markersRef.current).forEach((m) => m?.remove?.());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update route data
  useEffect(() => {
    routeRef.current = route && route.length ? route : null;
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const src = map.getSource("route");
    if (!src) return;
    if (route && route.length) {
      src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: route } });
    } else {
      src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] } });
    }
  }, [ready, route, styleGen]);

  // Zoom prop changes (e.g. driver toggles the demand heatmap) — glide, don't snap
  const lastZoomRef = useRef(zoom);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (Math.abs(lastZoomRef.current - zoom) < 0.05) return;
    lastZoomRef.current = zoom;
    mapRef.current.easeTo({ zoom, duration: 900 });
  }, [ready, zoom]);

  // Update demand heatmap data (real cells only — empty collection clears the layer)
  useEffect(() => {
    const features = (heat || []).map((h) => ({
      type: "Feature",
      properties: { w: h.weight ?? 1 },
      geometry: { type: "Point", coordinates: [h.lng, h.lat] },
    }));
    heatRef.current = features;
    if (!ready || !mapRef.current) return;
    const src = mapRef.current.getSource("demand");
    if (src) src.setData({ type: "FeatureCollection", features });
  }, [ready, heat, styleGen]);

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
  }, [ready, route, styleGen]);

  // Shift the visual center above the bottom sheet
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try { mapRef.current.easeTo({ padding: { top: 90, bottom: paddingBottom, left: 0, right: 0 }, duration: 450 }); } catch { /* ignore */ }
  }, [ready, paddingBottom]);

  // Fit bounds when both pickup & dropoff or fitBounds provided
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    let bounds = null;
    if (fitBounds) bounds = fitBounds;
    else if (pickup && dropoff) bounds = [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]];
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: { top: 110, bottom: (paddingBottom || 0) + 60, left: 60, right: 60 }, pitch, bearing, duration: 900, maxZoom: 15 });
      } catch { /* ignore */ }
    }
  }, [ready, fitBounds, pickup, dropoff, pitch, bearing, paddingBottom]);

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
      wanted[`nearby-${i}`] = { lng: c.lng, lat: c.lat, el: carEl(c.bearing || 0, false, c.eta) };
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
          const label = markersRef.current[k].getElement().querySelector(".car-eta");
          const eta = k.startsWith("nearby-") ? cars[parseInt(k.split("-")[1], 10)]?.eta : null;
          if (label && eta) label.textContent = `${eta} min`;
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

/** Premium car sprite — real studio top-down render with champagne halo.
 *  `eta` (minutes, from the driver's live GPS) is shown as a small brass pill. */
function carEl(bearing = 0, active = false, eta = null) {
  const box = active ? 62 : 50;
  const carW = active ? 30 : 24;
  const glow = active
    ? "drop-shadow(0 0 14px rgba(203,163,101,0.85)) drop-shadow(0 6px 10px rgba(0,0,0,0.6))"
    : "drop-shadow(0 0 8px rgba(203,163,101,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.55))";
  const label = eta
    ? `<div class="car-eta" style="position:absolute; left:50%; top:100%; transform:translate(-50%,-2px); padding:1px 6px; border-radius:999px; font-size:9px; letter-spacing:0.04em; white-space:nowrap; color:#070B0E; background:linear-gradient(140deg,#EED9A6,#CBA365); box-shadow:0 3px 8px rgba(0,0,0,0.5); font-family:'JetBrains Mono',ui-monospace,monospace;">${eta} min</div>`
    : "";
  return el(`
    <div class="premium-car" style="pointer-events:none; position:relative; width:${box}px; height:${box}px;">
      <div style="position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle, rgba(203,163,101,${active ? 0.3 : 0.16}), rgba(203,163,101,0) 70%);"></div>
      <div class="car-rotate" style="position:absolute; inset:0; display:grid; place-items:center; transform: rotate(${bearing}deg); transition: transform 0.6s ease; transform-origin: 50% 50%;">
        <img src="/vehicles/map-car.png" alt="" style="width:${carW}px; height:auto; filter:${glow};" />
      </div>
      ${label}
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
