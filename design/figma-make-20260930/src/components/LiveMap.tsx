import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// Public token — designed to ship in client-side code.
mapboxgl.accessToken =
  "pk.eyJ1Ijoia2phcHAiLCJhIjoiY21uOWN4NGFwMDVxbDJwc2gyNTNqbGNleiJ9.lZ8hI2Mdv1AzcyFlonX0Sw"

// User is centered in Oslo by default.
const USER: [number, number] = [10.7522, 59.9139] // [lng, lat]

type Car = { id: number; lng: number; lat: number; heading: number }

function makeCars(n: number): Car[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: i,
    lng: USER[0] + (Math.random() - 0.5) * 0.03,
    lat: USER[1] + (Math.random() - 0.5) * 0.018,
    heading: Math.random() * 360,
  }))
}

function carElement(): HTMLDivElement {
  const el = document.createElement("div")
  el.style.width = "30px"
  el.style.height = "30px"
  el.style.display = "flex"
  el.style.alignItems = "center"
  el.style.justifyContent = "center"
  el.innerHTML = `
    <div style="position:absolute;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle,rgba(255,0,0,0.22),transparent 70%);"></div>
    <div class="snar-car-rot" style="filter:drop-shadow(0 2px 4px rgba(255,0,0,0.5));transition:transform 1.2s linear;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff0000"><path d="M12 2l7 18-7-4-7 4z"/></svg>
    </div>`
  return el
}

function userElement(): HTMLDivElement {
  const el = document.createElement("div")
  el.style.position = "relative"
  el.style.width = "22px"
  el.style.height = "22px"
  el.innerHTML = `
    <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(255,0,0,0.35),transparent 70%);animation:ring-pulse 2.4s ease-out infinite;"></div>
    <div style="position:absolute;inset:6px;border-radius:50%;background:#ff0000;box-shadow:0 0 8px rgba(255,0,0,0.6);border:2px solid #ffffff;"></div>`
  return el
}

export default function LiveMap({
  count = 9,
  zoom = 13.4,
  spread = 1,
  showUser = true,
  showRadius = true,
}: {
  count?: number
  zoom?: number
  spread?: number
  showUser?: boolean
  showRadius?: boolean
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: USER,
      zoom,
      attributionControl: false,
      logoPosition: "bottom-left",
      config: {
        basemap: {
          theme: "monochrome",
          lightPreset: "day",
          showPointOfInterestLabels: false,
          show3dBuildings: false,
        },
      },
    })
    mapRef.current = map
    map.on("error", (e) => console.error("Map error:", e.error))

    const cars = makeCars(count).map((c) => ({
      ...c,
      lng: USER[0] + (c.lng - USER[0]) * spread,
      lat: USER[1] + (c.lat - USER[1]) * spread,
    }))
    const markers: { car: Car; marker: mapboxgl.Marker; rot: HTMLElement | null }[] = []

    map.on("load", () => {
      if (showRadius) {
        // accuracy radius around the user
        map.addSource("radius", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: USER } },
        })
        map.addLayer({
          id: "radius-fill",
          type: "circle",
          source: "radius",
          slot: "middle",
          paint: {
            "circle-radius": {
              stops: [
                [12, 60],
                [16, 320],
              ],
            },
            "circle-color": "#ff0000",
            "circle-opacity": 0.05,
            "circle-stroke-color": "#ff0000",
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.3,
          },
        })
      }

      // user + cars as GL markers (never drift on pan/zoom)
      if (showUser) new mapboxgl.Marker({ element: userElement() }).setLngLat(USER).addTo(map)
      for (const car of cars) {
        const el = carElement()
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([car.lng, car.lat]).addTo(map)
        const rot = el.querySelector<HTMLElement>(".snar-car-rot")
        if (rot) rot.style.transform = `rotate(${car.heading}deg)`
        markers.push({ car, marker, rot })
      }
    })

    const t = setInterval(() => {
      for (const m of markers) {
        const c = m.car
        const rad = (c.heading * Math.PI) / 180
        c.lat += Math.cos(rad) * 0.0006
        c.lng += Math.sin(rad) * 0.0006
        if (Math.random() < 0.25) c.heading += (Math.random() - 0.5) * 60
        if (Math.abs(c.lat - USER[1]) > 0.02) c.heading = (c.heading + 180) % 360
        if (Math.abs(c.lng - USER[0]) > 0.035) c.heading = (c.heading + 180) % 360
        c.heading = (c.heading + 360) % 360
        m.marker.setLngLat([c.lng, c.lat])
        if (m.rot) m.rot.style.transform = `rotate(${c.heading}deg)`
      }
    }, 1200)

    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(containerRef.current)

    return () => {
      clearInterval(t)
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" style={{ background: "#f4f6fa" }} />
      {/* soft top/bottom fade so overlays sit cleanly on the pearl map */}
      <div
        className="pointer-events-none absolute inset-0 z-[400]"
        style={{
          background:
            "linear-gradient(180deg, rgba(244,246,250,0.6), transparent 18%, transparent 72%, rgba(244,246,250,0.4))",
        }}
      />
    </div>
  )
}
