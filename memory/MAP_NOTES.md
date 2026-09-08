# KJAPP — Kart (MapLibre) notater

## Rotårsaker funnet 2026-09-08
1. **CARTO gratis raster-tiles vannmerkes nå med "API KEY REQUIRED"** (cartodb-basemaps-*.global.ssl.fastly.net og basemaps.cartocdn.com). Alle Leaflet/raster-fallbacks som brukte CARTO er fjernet.
2. **MapLibre-worker startet aldri i webpack-bundlen** (maplibre-gl 6.4.1 løser worker via `import.meta.url` → ikke http(s) under webpack → `new Worker("")`). Effekt: vektor-styles (OpenFreeMap Liberty tidligere) lastet aldri → alt falt tilbake til raster. Fiks: `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` i `PremiumMap.jsx`; worker + shared chunk kopieres til `public/maplibre/` via `yarn sync-map-worker` (kjøres automatisk i `prestart`/`prebuild`). Må være samme versjon som `node_modules/maplibre-gl`.

## Nåværende oppsett (PremiumMap.jsx)
- Uten nøkkel: **OpenFreeMap `dark`** vektor-style (gratis, ingen nøkkel, ingen grenser) hentes og re-farges (`nordicize`) til Fjord & Granite-paletten. `openmaptiles`-kilden gir 3D-bygg.
- Med `REACT_APP_MAPTILER_API_KEY`: MapTiler `streets-v2-dark`; ved 401/403 faller den tilbake til OpenFreeMap.
- Siste fallback: OSM raster mørklagt.
- Attribusjon (påkrevd): vises som tekstlinje nederst i Home-sheet ("Kart © OpenStreetMap · OpenMapTiles · OpenFreeMap").
- `paddingBottom`-prop skyver visuelt senter over bunn-arket (Home sender sheet-høyde + 84).
- Dev: `window.__kjappMap` eksponeres for debugging (ikke i production).
- DriverTrip bruker nå PremiumMap (ikke Leaflet). DriverHome importerer react-leaflet men bruker ikke kart.
