import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { pickupIcon, dropoffIcon, fleetCarIcon } from "../lib/mapAssets";
import { tripsApi, carsApi, placesApi, pricingApi, paymentApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Menu, Search, MapPin, Navigation, Home as HomeIcon, Briefcase, Star, Zap, CreditCard, AlertTriangle, ChevronRight } from "lucide-react";
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
  { id: "ai-first", name: "Standard", desc: "Rask og pålitelig", multiplier: 1.0 },
  { id: "enkelt", name: "Sparsom", desc: "Beste pris", multiplier: 0.85 },
  { id: "trygg", name: "Komfort", desc: "Rommelig / familie", multiplier: 1.2 },
  { id: "premium", name: "Premium", desc: "Business", multiplier: 1.8 },
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
  const [surge, setSurge] = useState({ active: false, multiplier: 1.0, reasons: [] });
  const [pickupSheetOpen, setPickupSheetOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const hasPaymentMethod = paymentMethods.length > 0;

  // Load payment methods to gate booking
  useEffect(() => {
    paymentApi.list().then(setPaymentMethods).catch(() => setPaymentMethods([]));
  }, []);

  // Load surge info once + every 5 min
  useEffect(() => {
    const load = () => pricingApi.surge().then(setSurge).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
    if (!hasPaymentMethod) {
      navigate("/app/payment-methods?required=1");
      return;
    }
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
      if (e?.response?.status === 402) {
        navigate("/app/payment-methods?required=1");
      } else {
        alert("Kunne ikke bestille tur. Prøv igjen.");
      }
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
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap, &copy; CartoDB'
          />
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
          {!dropoff && cars.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={fleetCarIcon} />
          ))}
          {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
          {routePoints && (
            <Polyline
              positions={routePoints}
              pathOptions={{ color: "#c9a15b", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
            />
          )}
          {routePoints && (
            <Polyline
              positions={routePoints}
              pathOptions={{ color: "#f4ecd8", weight: 1.2, opacity: 0.9, lineCap: "round", className: "polyline-shimmer" }}
            />
          )}
          {routePoints && <FitBounds points={routePoints} />}
        </MapContainer>
      </div>

      {/* Top header — glass pills, brass accent */}
      <div className="relative z-[1000] px-4 pt-3 flex items-center justify-between">
        <button
          className="w-11 h-11 grid place-items-center rounded-full backdrop-blur-xl"
          data-testid="home-menu"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)" }}
        >
          <Menu size={18} style={{ color: "var(--text)" }} />
        </button>
        <div
          className="font-display text-[19px] tracking-tight backdrop-blur-xl rounded-full px-5 py-2"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)", color: "var(--text)" }}
        >
          KJ<span style={{ color: "var(--accent)" }}>A</span>PP
        </div>
        <button
          className="w-11 h-11 grid place-items-center rounded-full backdrop-blur-xl"
          data-testid="home-orb-btn"
          onClick={() => navigate("/app/ai")}
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)" }}
        >
          <div className="orb orb-tiny" style={{ width: 22, height: 22 }} />
        </button>
      </div>

      {/* Bottom sheet — search / booking */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute left-0 right-0 bottom-6 z-[1000] px-4"
      >
        <div
          className="card p-4 shadow-card"
          style={{
            background: "rgba(12,18,22,0.92)",
            border: "1px solid rgba(232,224,208,0.10)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
          }}
        >
          <div className="sheet-handle" />
          {/* Pickup line — editable */}
          <button
            onClick={() => setPickupSheetOpen(true)}
            data-testid="home-edit-pickup"
            className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 rounded-2xl text-left transition-colors"
            style={{
              background: "rgba(232,224,208,0.04)",
              border: "1px solid rgba(232,224,208,0.08)",
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Fra</div>
              <div className="text-sm truncate" style={{ color: "var(--text)" }}>{pickup.name}</div>
            </div>
            <span className="text-[11px]" style={{ color: "var(--accent)" }}>Endre</span>
          </button>

          {!dropoff && (
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                <span className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
                  {cars.length > 0 ? `${cars.length} ledige biler nær deg` : "Ingen sjåfører på vakt akkurat nå"}
                </span>
              </div>
              {cars.length > 0 && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>nærmeste {cars[0]?.eta_min} min</span>}
            </div>
          )}

          {/* Surge chip — reason only, no percentage */}
          {surge.active && !dropoff && (
            <div
              className="mb-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl"
              style={{
                background: "rgba(215, 106, 90, 0.10)",
                border: "1px solid rgba(215, 106, 90, 0.25)",
              }}
              data-testid="surge-chip"
            >
              <Zap size={16} style={{ color: "#e39e5c" }} />
              <div className="flex-1">
                <div className="text-[12px] font-medium" style={{ color: "#e8c9b0" }}>
                  {surge.reasons.join(" + ")}
                </div>
                <div className="text-[10px]" style={{ color: "rgba(232,201,176,0.7)" }}>Litt høyere pris akkurat nå</div>
              </div>
            </div>
          )}
          {!dropoff ? (
            <>
              <button
                onClick={() => setShowSheet(true)}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-colors"
                style={{
                  background: "rgba(232,224,208,0.05)",
                  border: "1px solid rgba(232,224,208,0.10)",
                }}
                data-testid="home-where-to"
              >
                <Search size={18} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--text)" }}>Hvor skal du?</span>
              </button>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {places.filter(p => ["Hjem", "Jobb", "Sentralstasjon"].includes(p.label)).slice(0, 3).map((p) => {
                  const Ic = iconFor(p.label);
                  return (
                    <button
                      key={p.name}
                      onClick={() => setDropoff({ name: p.name, lat: p.lat, lng: p.lng })}
                      className="flex flex-col items-center gap-2 py-3 rounded-2xl transition-colors"
                      style={{
                        background: "rgba(232,224,208,0.04)",
                        border: "1px solid rgba(232,224,208,0.08)",
                      }}
                      data-testid={`quick-${p.label}`}
                    >
                      <Ic size={18} style={{ color: "var(--accent)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.label}</span>
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
              hasPaymentMethod={hasPaymentMethod}
              defaultCardLabel={paymentMethods.find(m => m.is_default)?.label || paymentMethods[0]?.label}
              defaultCardLast4={paymentMethods.find(m => m.is_default)?.last4 || paymentMethods[0]?.last4}
              onAddCard={() => navigate("/app/payment-methods?required=1")}
            />
          )}
        </div>
      </motion.div>

      {/* Search sheet modal — destination */}
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

      {/* Search sheet modal — pickup */}
      <AnimatePresence>
        {pickupSheetOpen && (
          <SearchSheet
            places={places}
            onClose={() => setPickupSheetOpen(false)}
            onPick={(p) => {
              setPickup(p);
              setPickupSheetOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingReview({ pickup, dropoff, vehicle, onVehicleChange, distanceKm, estPrice, onCancel, onConfirm, requesting, hasPaymentMethod, defaultCardLabel, defaultCardLast4, onAddCard }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col items-center pt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          <div className="w-px h-8" style={{ background: "rgba(232,224,208,0.14)" }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Fra</div>
          <div className="text-sm truncate" style={{ color: "var(--text)" }}>{pickup.name}</div>
          <div className="text-[13px] mt-2" style={{ color: "var(--text-muted)" }}>Til</div>
          <div className="text-sm truncate" style={{ color: "var(--text)" }}>{dropoff.name}</div>
        </div>
        <button onClick={onCancel} className="text-xs hover:opacity-70" style={{ color: "var(--text-muted)" }} data-testid="booking-cancel">Endre</button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {VEHICLES.map((v) => (
          <button
            key={v.id}
            onClick={() => onVehicleChange(v.id)}
            data-testid={`vehicle-${v.id}`}
            className="px-3 py-2.5 rounded-2xl text-left transition-all"
            style={{
              background: vehicle === v.id ? "rgba(201,161,91,0.10)" : "rgba(232,224,208,0.04)",
              border: `1px solid ${vehicle === v.id ? "rgba(201,161,91,0.35)" : "rgba(232,224,208,0.08)"}`,
            }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{v.name}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{v.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{distanceKm.toFixed(1)} km · est.</span>
        <span className="font-display text-[22px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{estPrice} kr</span>
      </div>

      {/* Payment method row */}
      {hasPaymentMethod ? (
        <button
          onClick={onAddCard}
          data-testid="booking-payment-row"
          className="w-full mb-3 flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left"
          style={{
            background: "rgba(232,224,208,0.04)",
            border: "1px solid rgba(232,224,208,0.08)",
          }}
        >
          <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(201,161,91,0.12)" }}>
            <CreditCard size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm" style={{ color: "var(--text)" }}>{defaultCardLabel || "Kort"}{defaultCardLast4 ? ` •• ${defaultCardLast4}` : ""}</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Trykk for å bytte</div>
          </div>
          <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
        </button>
      ) : (
        <button
          onClick={onAddCard}
          data-testid="booking-add-card"
          className="w-full mb-3 flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors text-left"
          style={{
            background: "rgba(215,106,90,0.10)",
            border: "1px solid rgba(215,106,90,0.30)",
          }}
        >
          <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(215,106,90,0.18)" }}>
            <AlertTriangle size={16} style={{ color: "#e39e5c" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: "#e8c9b0" }}>Legg til betalingskort først</div>
            <div className="text-[10px]" style={{ color: "rgba(232,201,176,0.7)" }}>Vi må ha et gyldig kort før du kan bestille</div>
          </div>
        </button>
      )}

      <button
        onClick={onConfirm}
        disabled={requesting || !hasPaymentMethod}
        data-testid="booking-confirm"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {requesting ? (
          <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-on)", borderTopColor: "transparent" }} />
        ) : hasPaymentMethod ? (
          <>Bestill nå · {estPrice} kr</>
        ) : (
          <>Legg til kort for å bestille</>
        )}
      </button>
    </div>
  );
}

function SearchSheet({ onClose, onPick, places = [] }) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = React.useRef(null);

  const q = query.trim();
  const local = places.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (q.length < 3) { setRemote([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await placesApi.search(q);
        setRemote(r.results || []);
      } catch { setRemote([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[1002]"
      style={{ background: "rgba(12,18,22,0.96)", backdropFilter: "blur(20px)" }}
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        exit={{ y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="p-6 pt-14"
      >
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(232,224,208,0.06)", color: "var(--text-muted)" }} data-testid="search-close">✕</button>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input"
            placeholder="Skriv en adresse i Norge…"
            data-testid="search-input"
          />
        </div>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto no-scrollbar">
          {local.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest px-2 mt-1" style={{ color: "var(--text-muted)" }}>Favoritter</div>
          )}
          {local.map((p) => (
            <button
              key={"local-" + p.name}
              onClick={() => onPick(p)}
              data-testid={`search-result-${p.name}`}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-colors text-left"
              style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
            >
              <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
                <Star size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.label}</div>
              </div>
              <Navigation size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
          {(remote.length > 0 || loading) && (
            <div className="text-[10px] uppercase tracking-widest px-2 mt-3" style={{ color: "var(--text-muted)" }}>
              {loading ? "Søker…" : "Adresser i Norge"}
            </div>
          )}
          {remote.map((p, idx) => (
            <button
              key={"remote-" + idx + "-" + p.lat}
              onClick={() => onPick({ name: p.name, lat: p.lat, lng: p.lng })}
              data-testid={`geo-result-${idx}`}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-colors text-left"
              style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
            >
              <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
                <MapPin size={18} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{p.display_name}</div>
              </div>
              <Navigation size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
          {!loading && q.length >= 3 && remote.length === 0 && local.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
              Ingen treff for &quot;{q}&quot;. Prøv full adresse med gatenavn + husnummer.
            </div>
          )}
          {q.length < 3 && local.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
              Skriv minst 3 tegn (f.eks. &quot;Storgata 15&quot;)
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
