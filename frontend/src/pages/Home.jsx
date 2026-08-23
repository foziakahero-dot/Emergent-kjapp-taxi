import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PremiumMap from "../components/PremiumMap";
import { tripsApi, carsApi, placesApi, pricingApi, paymentApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Menu, Search, MapPin, Navigation, Home as HomeIcon, Briefcase, Star, Zap, CreditCard, AlertTriangle, ChevronRight, Users, Sparkles, Car as CarIcon, ChevronDown, ChevronUp, User, History, Settings as SettingsIcon, LogOut, HelpCircle, X } from "lucide-react";
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
  { id: "ai-first",  name: "Standard", desc: "Din raskeste vei hjem",  multiplier: 1.0,  capacity: 4, tagline: "Rask", eta: 3 },
  { id: "enkelt",    name: "Sparsom",  desc: "Grønnere · lavere pris",  multiplier: 0.85, capacity: 4, tagline: "Spar",  eta: 4 },
  { id: "trygg",     name: "Komfort",  desc: "Ekstra plass · barnesete", multiplier: 1.2,  capacity: 6, tagline: "Familie", eta: 5 },
  { id: "premium",   name: "Premium",  desc: "Business · sort bil",     multiplier: 1.8,  capacity: 4, tagline: "Signature", eta: 6 },
];

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
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const verifiedMethods = useMemo(() => paymentMethods.filter((m) => m.verified !== false), [paymentMethods]);
  const hasPaymentMethod = paymentMethods.length > 0;
  const hasVerifiedPaymentMethod = verifiedMethods.length > 0;
  const defaultMethod = useMemo(() => verifiedMethods.find((m) => m.is_default) || verifiedMethods[0] || paymentMethods.find((m) => m.is_default) || paymentMethods[0], [paymentMethods, verifiedMethods]);
  const defaultMethodVerified = !!defaultMethod && defaultMethod.verified !== false;

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

  // Load available cars nearby — refresh every 6s to match backend cruise cadence
  useEffect(() => {
    carsApi.nearby(pickup.lat, pickup.lng).then((r) => setCars(r.cars || [])).catch(() => {});
    const t = setInterval(() => {
      carsApi.nearby(pickup.lat, pickup.lng).then((r) => setCars(r.cars || [])).catch(() => {});
    }, 6000);
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

  const distanceKm = routeInfo?.distance_km ?? 0;

  const estPrice = useMemo(() => {
    if (!routeInfo) return 0;
    const opt = routeInfo.options.find((o) => o.vehicle_type === vehicle);
    return opt?.price || 0;
  }, [routeInfo, vehicle]);

  const requestTrip = async () => {
    if (!dropoff) return;
    if (!hasVerifiedPaymentMethod) {
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

  const mapRoute = useMemo(() => {
    if (!dropoff) return null;
    if (routeGeom?.coordinates?.length) return routeGeom.coordinates; // [lng,lat]
    return [[pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]];
  }, [pickup, dropoff, routeGeom]);

  const nearbyCarsForMap = useMemo(() => {
    if (dropoff) return []; // hide nearby when route is drawn
    return cars.map((c) => ({ lat: c.lat, lng: c.lng, bearing: c.heading || 0 }));
  }, [cars, dropoff]);

  return (
    <div className="relative" style={{ height: "calc(100dvh - 80px)" }}>
      {/* Map — MapLibre GL 3D */}
      <div className="absolute inset-x-0 top-0 bottom-0">
        <PremiumMap
          center={[pickup.lng, pickup.lat]}
          zoom={dropoff ? 13.5 : 13}
          pitch={45}
          route={mapRoute}
          pickup={pickup}
          dropoff={dropoff}
          cars={nearbyCarsForMap}
          testid="home-map"
        />
      </div>

      {/* Top header — glass pills, brass accent */}
      <div className="relative z-[1000] px-4 pt-3 flex items-center justify-between">
        <button
          className="w-11 h-11 grid place-items-center rounded-full backdrop-blur-xl transition-transform active:scale-95"
          data-testid="home-menu"
          onClick={() => setMenuOpen(true)}
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
          className="w-11 h-11 grid place-items-center rounded-full backdrop-blur-xl transition-transform active:scale-95"
          data-testid="home-orb-btn"
          onClick={() => navigate("/app/ai")}
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)" }}
        >
          <div className="orb orb-tiny" style={{ width: 22, height: 22 }} />
        </button>
      </div>

      {/* Customer side menu */}
      <AnimatePresence>
        {menuOpen && <CustomerMenu onClose={() => setMenuOpen(false)} navigate={navigate} userName={user?.fullName} />}
      </AnimatePresence>

      {/* Bottom sheet — search / booking (can be minimized) */}
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
          {/* Collapse handle + toggle */}
          <button
            onClick={() => setSheetCollapsed((v) => !v)}
            data-testid="sheet-toggle"
            className="w-full flex flex-col items-center gap-1 pb-1 -mt-1 group"
            aria-label={sheetCollapsed ? "Åpne søk" : "Minimer søk"}
          >
            <div className="sheet-handle" />
          </button>

          {sheetCollapsed ? (
            <button
              onClick={() => setSheetCollapsed(false)}
              data-testid="sheet-expand"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl transition-colors"
              style={{ background: "rgba(232,224,208,0.05)", border: "1px solid rgba(232,224,208,0.10)" }}
            >
              <Search size={16} style={{ color: "var(--accent)" }} />
              <span className="flex-1 text-left text-sm" style={{ color: "var(--text)" }}>
                {cars.length > 0 ? `${cars.length} biler i nærheten · nærmeste ${cars[0]?.eta_min} min` : "Ingen sjåfører på vakt akkurat nå"}
              </span>
              <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          ) : (
            <>
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
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Hentes fra</div>
              <div className="text-sm truncate" style={{ color: "var(--text)" }}>{pickup.name}</div>
            </div>
            <span className="text-[11px]" style={{ color: "var(--accent)" }}>Endre</span>
          </button>

          {!dropoff && (
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                <span className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
                  {cars.length > 0 ? `${cars.length} biler i nærheten` : "Ingen sjåfører på vakt akkurat nå"}
                </span>
              </div>
              {cars.length > 0 && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Nærmeste bil er {cars[0]?.eta_min} min unna</span>}
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
              options={routeInfo?.options || []}
              onCancel={() => setDropoff(null)}
              onConfirm={requestTrip}
              requesting={requesting}
              hasPaymentMethod={hasPaymentMethod}
              hasVerifiedPaymentMethod={hasVerifiedPaymentMethod}
              defaultMethod={defaultMethod}
              defaultMethodVerified={defaultMethodVerified}
              onAddCard={() => navigate("/app/payment-methods?required=1")}
            />
          )}
            </>
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

function CustomerMenu({ onClose, navigate, userName }) {
  const items = [
    { label: "Turhistorikk", path: "/app/history", Icon: History },
    { label: "Bankkort", path: "/app/payment-methods", Icon: CreditCard },
    { label: "Profil", path: "/app/profile", Icon: User },
    { label: "Innstillinger", path: "/app/settings", Icon: SettingsIcon },
    { label: "Hjelp og støtte", path: "/app/help", Icon: HelpCircle },
  ];
  const go = (p) => { onClose(); navigate(p); };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1400]"
      style={{ background: "rgba(4,8,10,0.72)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
      data-testid="customer-menu"
    >
      <motion.aside
        initial={{ x: -320 }}
        animate={{ x: 0 }}
        exit={{ x: -320 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="absolute left-0 top-0 bottom-0 w-[290px] flex flex-col"
        style={{ background: "rgba(12,18,22,0.98)", borderRight: "1px solid rgba(232,224,208,0.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(232,224,208,0.08)" }}>
          <div className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "rgba(201,161,91,0.18)", color: "var(--accent)", fontWeight: 600 }}>
            {(userName || "K").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Kunde</div>
            <div className="text-sm truncate" style={{ color: "var(--text)" }}>{userName || "Gjest"}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(232,224,208,0.06)", color: "var(--text-muted)" }} data-testid="menu-close">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <button
              key={it.path}
              onClick={() => go(it.path)}
              data-testid={`menu-${it.path.replace(/\//g, "-")}`}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors"
              style={{ background: "transparent", color: "var(--text)" }}
            >
              <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(232,224,208,0.05)" }}>
                <it.Icon size={16} style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-sm">{it.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(232,224,208,0.08)" }}>
          <button
            onClick={() => { localStorage.removeItem("kjapp_token"); window.location.href = "/login"; }}
            data-testid="menu-logout"
            className="w-full flex items-center gap-2 justify-center py-2.5 rounded-2xl text-sm"
            style={{ background: "rgba(232,224,208,0.05)", color: "var(--text-muted)" }}
          >
            <LogOut size={14} /> Logg ut
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}


function BookingReview({ pickup, dropoff, vehicle, onVehicleChange, distanceKm, estPrice, options, onCancel, onConfirm, requesting, hasPaymentMethod, hasVerifiedPaymentMethod, defaultMethod, defaultMethodVerified, onAddCard }) {  const selected = VEHICLES.find((v) => v.id === vehicle) || VEHICLES[0];
  const priceFor = (vid) => (options?.find?.((o) => o.vehicle_type === vid)?.price) || 0;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex flex-col items-center pt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          <div className="w-px h-8" style={{ background: "rgba(232,224,208,0.14)" }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Hentes fra</div>
          <div className="text-sm truncate" style={{ color: "var(--text)" }}>{pickup.name}</div>
          <div className="text-[13px] mt-2" style={{ color: "var(--text-muted)" }}>Kjøres til</div>
          <div className="text-sm truncate" style={{ color: "var(--text)" }}>{dropoff.name}</div>
        </div>
        <button onClick={onCancel} className="text-xs hover:opacity-70" style={{ color: "var(--text-muted)" }} data-testid="booking-cancel">Endre</button>
      </div>

      {/* Premium horizontal vehicle picker — snap-scroll on mobile */}
      <div className="-mx-4 px-4 mb-3 flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth" style={{ scrollSnapType: "x mandatory" }}>
        {VEHICLES.map((v) => {
          const active = vehicle === v.id;
          const price = priceFor(v.id);
          return (
            <button
              key={v.id}
              onClick={() => onVehicleChange(v.id)}
              data-testid={`vehicle-${v.id}`}
              className="shrink-0 rounded-2xl p-3 relative overflow-hidden transition-all"
              style={{
                minWidth: 138,
                background: active ? "linear-gradient(155deg, rgba(201,161,91,0.16), rgba(201,161,91,0.06))" : "rgba(232,224,208,0.04)",
                border: `1px solid ${active ? "rgba(201,161,91,0.55)" : "rgba(232,224,208,0.08)"}`,
                boxShadow: active ? "0 8px 30px var(--accent-glow)" : "none",
                scrollSnapAlign: "start",
              }}
            >
              {/* car silhouette (SVG isometric) */}
              <div className="h-11 flex items-center justify-center mb-1.5" aria-hidden>
                <VehicleGlyph id={v.id} active={active} />
              </div>
              <div className="flex items-baseline justify-between mb-0.5">
                <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{v.name}</div>
                <div className="text-[9px] tracking-widest uppercase" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{v.tagline}</div>
              </div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{v.desc}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "rgba(232,224,208,0.08)" }}>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <Users size={11} /> {v.capacity}
                </div>
                <div className="font-display text-[15px] leading-none" style={{ color: active ? "var(--accent)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {price} kr
                </div>
              </div>
              {active && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full grid place-items-center" style={{ background: "var(--accent)" }}>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none"><path d="M5 12l5 5L20 7" stroke="var(--accent-on)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{distanceKm.toFixed(1)} km · sjåfør kan hente deg om {selected.eta} min</span>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Ca. pris</div>
          <div className="font-display text-[22px] leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{estPrice} kr</div>
        </div>
      </div>

      {/* Payment method row with verification status */}
      <PaymentRow
        hasPaymentMethod={hasPaymentMethod}
        hasVerified={hasVerifiedPaymentMethod}
        defaultMethod={defaultMethod}
        defaultMethodVerified={defaultMethodVerified}
        onAddCard={onAddCard}
      />

      <button
        onClick={onConfirm}
        disabled={requesting || !hasVerifiedPaymentMethod}
        data-testid="booking-confirm"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {requesting ? (
          <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-on)", borderTopColor: "transparent" }} />
        ) : !hasPaymentMethod ? (
          <>Legg til bankkort for å bestille</>
        ) : !hasVerifiedPaymentMethod ? (
          <>Fullfør kortverifisering</>
        ) : (
          <>Bestill bilen · {estPrice} kr</>
        )}
      </button>
    </div>
  );
}

/* Premium isometric car glyph per category */
function VehicleGlyph({ id, active }) {
  const stroke = active ? "#c9a15b" : "rgba(232,224,208,0.55)";
  const fill = active ? "#0c1216" : "#0e1418";
  const glass = active ? "#c9a15b" : "rgba(232,224,208,0.45)";
  if (id === "premium") {
    return (
      <svg viewBox="0 0 68 40" width="70" height="40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="34" cy="35" rx="26" ry="3" fill="#000" opacity="0.35"/>
        <path d="M8 26 Q10 16 24 14 L44 14 Q58 16 60 26 L60 30 Q60 32 58 32 L10 32 Q8 32 8 30 Z" fill={fill} stroke={stroke} strokeWidth="1.4"/>
        <path d="M18 18 Q20 12 26 12 L42 12 Q48 12 50 18 L50 22 L18 22 Z" fill={glass} opacity="0.9"/>
        <circle cx="20" cy="32" r="4" fill="#000"/><circle cx="20" cy="32" r="2" fill={stroke}/>
        <circle cx="48" cy="32" r="4" fill="#000"/><circle cx="48" cy="32" r="2" fill={stroke}/>
        <rect x="55" y="24" width="4" height="2" rx="1" fill="#fff9e8"/>
      </svg>
    );
  }
  if (id === "trygg") {
    return (
      <svg viewBox="0 0 68 40" width="66" height="40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="34" cy="35" rx="26" ry="3" fill="#000" opacity="0.35"/>
        <path d="M8 22 L8 30 Q8 32 10 32 L58 32 Q60 32 60 30 L60 22 Q60 10 46 10 L22 10 Q8 10 8 22 Z" fill={fill} stroke={stroke} strokeWidth="1.4"/>
        <path d="M12 14 L26 14 L26 22 L12 22 Z" fill={glass} opacity="0.85"/>
        <path d="M28 14 L44 14 L44 22 L28 22 Z" fill={glass} opacity="0.85"/>
        <path d="M46 14 L56 14 Q56 22 56 22 L46 22 Z" fill={glass} opacity="0.85"/>
        <circle cx="20" cy="32" r="4" fill="#000"/><circle cx="20" cy="32" r="2" fill={stroke}/>
        <circle cx="48" cy="32" r="4" fill="#000"/><circle cx="48" cy="32" r="2" fill={stroke}/>
      </svg>
    );
  }
  if (id === "enkelt") {
    return (
      <svg viewBox="0 0 68 40" width="64" height="40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="34" cy="35" rx="24" ry="3" fill="#000" opacity="0.35"/>
        <path d="M12 24 Q14 18 22 16 L46 16 Q54 18 56 24 L56 30 Q56 32 54 32 L14 32 Q12 32 12 30 Z" fill={fill} stroke={stroke} strokeWidth="1.4"/>
        <path d="M22 18 L46 18 L48 22 L20 22 Z" fill={glass} opacity="0.85"/>
        <circle cx="22" cy="32" r="4" fill="#000"/><circle cx="22" cy="32" r="2" fill={stroke}/>
        <circle cx="46" cy="32" r="4" fill="#000"/><circle cx="46" cy="32" r="2" fill={stroke}/>
        {/* leaf motif */}
        <path d="M54 18 Q58 16 60 20 Q58 22 54 20 Z" fill="#8ac48f"/>
      </svg>
    );
  }
  // ai-first / Standard — modern sedan
  return (
    <svg viewBox="0 0 68 40" width="66" height="40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="34" cy="35" rx="25" ry="3" fill="#000" opacity="0.35"/>
      <path d="M10 25 Q12 18 22 15 L46 15 Q56 18 58 25 L58 30 Q58 32 56 32 L12 32 Q10 32 10 30 Z" fill={fill} stroke={stroke} strokeWidth="1.4"/>
      <path d="M20 18 L48 18 L50 22 L18 22 Z" fill={glass} opacity="0.9"/>
      <circle cx="21" cy="32" r="4" fill="#000"/><circle cx="21" cy="32" r="2" fill={stroke}/>
      <circle cx="47" cy="32" r="4" fill="#000"/><circle cx="47" cy="32" r="2" fill={stroke}/>
    </svg>
  );
}

/* Payment row with verification pill */
function PaymentRow({ hasPaymentMethod, hasVerified, defaultMethod, defaultMethodVerified, onAddCard }) {
  // Compact verified card row — the actual "no card" case is handled by the CTA button label + click routing.
  return (
    <button
      onClick={onAddCard}
      data-testid="booking-payment-row"
      className="w-full mb-3 flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left"
      style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
    >
      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(201,161,91,0.12)" }}>
        <CreditCard size={16} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2 flex-wrap" style={{ color: "var(--text)" }}>
          <span className="truncate">
            {hasPaymentMethod
              ? `${defaultMethod?.label || "Kort"}${defaultMethod?.last4 ? ` •• ${defaultMethod.last4}` : ""}`
              : "Ingen kort lagret"}
          </span>
          {hasPaymentMethod && defaultMethodVerified && (
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(138,196,143,0.14)", color: "#8ac48f" }}>Verifisert</span>
          )}
          {hasPaymentMethod && !defaultMethodVerified && (
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(227,158,92,0.14)", color: "#e39e5c" }}>Verifiseres</span>
          )}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {hasPaymentMethod ? "Trykk for å endre" : "Trykk her for å legge til"}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
    </button>
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
