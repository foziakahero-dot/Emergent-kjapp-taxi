import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { pickupIcon, dropoffIcon, fleetCarIcon } from "../lib/mapAssets";
import { tripsApi, carsApi, placesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Menu, Search, MapPin, Navigation, Home as HomeIcon, Briefcase, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Orb } from "../components/UIKit";

// Oslo defaults
const DEFAULT_CENTER = [59.9139, 10.7522];

const PLACES_FALLBACK = [
  { name: "Karl Johans gate 1", lat: 59.9127, lng: 10.7461, label: "Hjem" },
  { name: "Aker Brygge", lat: 59.9106, lng: 10.7285, label: "Jobb" },
  { name: "Oslo S", lat: 59.9110, lng: 10.7530, label: "Sentralstasjon" },
];

const VEHICLES = [
  { id: "ai-first", name: "AI-First", desc: "Smart tildeling", multiplier: 1.0 },
  { id: "enkelt", name: "Enkelt", desc: "Beste pris", multiplier: 0.85 },
  { id: "trygg", name: "Trygg", desc: "Erfarne sjåfører", multiplier: 1.2 },
  { id: "premium", name: "Premium", desc: "Tesla Model S", multiplier: 1.8 },
];

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      map.fitBounds(points, { padding: [60, 60], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState({ name: "Din posisjon", lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
  const [dropoff, setDropoff] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [vehicle, setVehicle] = useState("ai-first");
  const [requesting, setRequesting] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [cars, setCars] = useState([]);
  const [places, setPlaces] = useState(PLACES_FALLBACK);
  const [routeGeom, setRouteGeom] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null); // {distance_km, duration_min, options[]}

  // Load real route via OSRM whenever a destination is chosen
  useEffect(() => {
    if (!dropoff) { setRouteGeom(null); setRouteInfo(null); return; }
    tripsApi.estimate({
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
    }).then((r) => {
      setRouteInfo(r);
      setRouteGeom(r.geometry || null);
    }).catch(() => {});
  }, [dropoff, pickup.lat, pickup.lng]);

  // Load places from backend
  useEffect(() => {
    placesApi.list().then((r) => setPlaces(r.places || PLACES_FALLBACK)).catch(() => {});
  }, []);

  // icon resolver for backend places
  const iconFor = (label) => {
    if (label === "Hjem") return HomeIcon;
    if (label === "Jobb") return Briefcase;
    return MapPin;
  };

  // Load available cars nearby
  useEffect(() => {
    carsApi.nearby(pickup.lat, pickup.lng).then((r) => setCars(r.cars || [])).catch(() => {});
    const t = setInterval(() => {
      carsApi.nearby(pickup.lat, pickup.lng).then((r) => setCars(r.cars || [])).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [pickup.lat, pickup.lng]);

  // detect existing active trip and redirect
  useEffect(() => {
    tripsApi.active().then((t) => {
      if (t && ["searching", "booking", "driver_on_way", "in_trip", "arrived"].includes(t.status)) {
        setActiveTrip(t);
        navigate(`/app/booking/${t.trip_id}`);
      }
    }).catch(() => {});
  }, [navigate]);

  // get user's location if allowed
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPickup({ name: "Din posisjon", lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {}
      );
    }
  }, []);

  const routePoints = useMemo(() => {
    if (!dropoff) return null;
    if (routeGeom?.coordinates?.length) return routeGeom.coordinates.map(([lng, lat]) => [lat, lng]);
    return [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]];
  }, [pickup, dropoff, routeGeom]);

  const distanceKm = routeInfo?.distance_km ?? 0;

  const estPrice = useMemo(() => {
    if (!routeInfo) return 0;
    const opt = routeInfo.options.find((o) => o.vehicle_type === vehicle);
    return opt?.price || 0;
  }, [routeInfo, vehicle]);

  const requestTrip = async () => {
    if (!dropoff) return;
    setRequesting(true);
    try {
      const trip = await tripsApi.request({
        pickup_address: pickup.name,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_type: vehicle,
      });
      navigate(`/app/booking/${trip.trip_id}`);
    } catch (e) {
      alert("Kunne ikke bestille tur. Prøv igjen.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="relative" style={{ height: "calc(100dvh - 80px)" }}>
      {/* Map */}
      <div className="absolute inset-x-0 top-0 bottom-0">
        <MapContainer
          center={[pickup.lat, pickup.lng]}
          zoom={13}
          zoomControl={false}
          className="w-full h-full"
          attributionControl={true}
        >
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap, &copy; CartoDB'
          />
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
          {!dropoff && cars.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={fleetCarIcon} />
          ))}
          {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
          {routePoints && (
            <Polyline positions={routePoints} pathOptions={{ color: "#2fe08c", weight: 4, opacity: 0.9, dashArray: "0" }} />
          )}
          {routePoints && <FitBounds points={routePoints} />}
        </MapContainer>
      </div>

      {/* Top header */}
      <div className="relative z-[1000] px-4 pt-2 flex items-center justify-between">
        <button className="w-10 h-10 grid place-items-center rounded-full bg-[#111a2b]/85 border border-line backdrop-blur-md" data-testid="home-menu">
          <Menu size={18} className="text-white" />
        </button>
        <div className="font-display text-lg tracking-tight text-white bg-[#111a2b]/85 border border-line backdrop-blur-md rounded-full px-5 py-2">
          KJ<span className="text-mint">A</span>PP
        </div>
        <button className="w-10 h-10 grid place-items-center rounded-full bg-[#111a2b]/85 border border-line backdrop-blur-md" data-testid="home-orb-btn" onClick={() => navigate("/app/ai")}>
          <div className="orb orb-tiny" style={{ width: 24, height: 24 }} />
        </button>
      </div>

      {/* Bottom sheet — search / booking */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute left-0 right-0 bottom-6 z-[1000] px-4"
      >
        <div className="card p-4 shadow-card backdrop-blur-xl bg-[#111a2b]/95">
          {!dropoff && cars.length > 0 && (
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
                <span className="text-[12px] text-mint font-medium">{cars.length} ledige biler nær deg</span>
              </div>
              <span className="text-[11px] text-[#8a94a8]">nærmeste {cars[0]?.eta_min} min</span>
            </div>
          )}
          {!dropoff ? (
            <>
              <button
                onClick={() => setShowSheet(true)}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-[#17223a] border border-line hover:border-mint transition-colors"
                data-testid="home-where-to"
              >
                <Search size={18} className="text-mint" />
                <span className="text-[#f4f1e8]">Hvor skal du?</span>
              </button>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {places.filter(p => ["Hjem", "Jobb", "Sentralstasjon"].includes(p.label)).slice(0, 3).map((p) => {
                  const Ic = iconFor(p.label);
                  return (
                    <button
                      key={p.name}
                      onClick={() => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
                      className="flex flex-col items-center gap-2 py-3 rounded-xl bg-[#17223a] border border-line hover:border-mint transition-colors"
                      data-testid={`quick-${p.label}`}
                    >
                      <Ic size={18} className="text-mint" />
                      <span className="text-[11px] text-[#b8bfd0]">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <BookingReview
              pickup={pickup}
              dropoff={dropoff}
              vehicle={vehicle}
              onVehicleChange={setVehicle}
              distanceKm={distanceKm}
              estPrice={estPrice}
              onCancel={() => setDropoff(null)}
              onConfirm={requestTrip}
              requesting={requesting}
            />
          )}
        </div>
      </motion.div>

      {/* Search sheet modal */}
      <AnimatePresence>
        {showSheet && (
          <SearchSheet
            places={places}
            onClose={() => setShowSheet(false)}
            onPick={(p) => {
              setDropoff(p);
              setShowSheet(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingReview({ pickup, dropoff, vehicle, onVehicleChange, distanceKm, estPrice, onCancel, onConfirm, requesting }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col items-center pt-1">
          <div className="w-2.5 h-2.5 rounded-full bg-mint" />
          <div className="w-px h-8 bg-[#2a3550]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-[#8a94a8]">Fra</div>
          <div className="text-white text-sm truncate">{pickup.name}</div>
          <div className="text-[13px] text-[#8a94a8] mt-2">Til</div>
          <div className="text-white text-sm truncate">{dropoff.name}</div>
        </div>
        <button onClick={onCancel} className="text-[#8a94a8] text-xs hover:text-white" data-testid="booking-cancel">Endre</button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {VEHICLES.map((v) => (
          <button
            key={v.id}
            onClick={() => onVehicleChange(v.id)}
            data-testid={`vehicle-${v.id}`}
            className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
              vehicle === v.id ? "border-mint bg-mint/10" : "border-line bg-[#17223a]"
            }`}
          >
            <div className="text-white text-sm font-medium">{v.name}</div>
            <div className="text-[11px] text-[#8a94a8]">{v.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[#8a94a8] text-sm">{distanceKm.toFixed(1)} km · est.</span>
        <span className="text-white text-lg font-semibold">{estPrice} kr</span>
      </div>

      <button
        onClick={onConfirm}
        disabled={requesting}
        data-testid="booking-confirm"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {requesting ? (
          <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>Bestill nå · {estPrice} kr</>
        )}
      </button>
    </div>
  );
}

function SearchSheet({ onClose, onPick, places = [] }) {
  const [query, setQuery] = useState("");
  const filtered = places.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[1002] bg-bg/95 backdrop-blur-xl"
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        exit={{ y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="p-6 pt-14"
      >
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="text-[#8a94a8]" data-testid="search-close">✕</button>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input"
            placeholder="Søk etter destinasjon"
            data-testid="search-input"
          />
        </div>
        <div className="space-y-2">
          {filtered.map((p) => (
            <button
              key={p.name}
              onClick={() => onPick(p)}
              data-testid={`search-result-${p.name}`}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#111a2b] border border-line hover:border-mint transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
                <MapPin size={18} className="text-mint" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{p.name}</div>
                <div className="text-[#8a94a8] text-xs">{p.label}</div>
              </div>
              <Navigation size={16} className="text-[#8a94a8]" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-[#8a94a8] text-sm">Ingen treff. Prøv et annet søk.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
