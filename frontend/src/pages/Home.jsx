import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PremiumMap from "../components/PremiumMap";
import { tripsApi, carsApi, placesApi, pricingApi, paymentApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Menu, Search, MapPin, Navigation, Home as HomeIcon, Briefcase, Star, Zap, CreditCard, AlertTriangle, ChevronRight, Users, Sparkles, Car as CarIcon, ChevronDown, ChevronUp, User, History, Settings as SettingsIcon, LogOut, HelpCircle, X, Plane } from "lucide-react";
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

/** 3-tier vehicle preview shown BEFORE destination is picked — brand identity strip. */
const VEHICLE_TIERS = [
  { id: "ai-first", name: "KJAPP",   tagline: "Rask & rimelig" },
  { id: "premium",  name: "KJAPP+",  tagline: "Premium bil" },
  { id: "trygg",    name: "KJAPP XL", tagline: "Familie · bagasje" },
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
    if (label === "Flyplass") return Plane;
    return MapPin;
  };

  // Nordic greeting based on time of day
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return "God natt";
    if (h < 10) return "God morgen";
    if (h < 12) return "God formiddag";
    if (h < 17) return "God ettermiddag";
    if (h < 22) return "God kveld";
    return "God natt";
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
          pickup={dropoff ? pickup : null}
          dropoff={dropoff}
          userPos={dropoff ? null : pickup}
          cars={nearbyCarsForMap}
          testid="home-map"
        />
      </div>

      {/* Top header — glass pills, brass accent */}
      <div className="relative z-[1000] px-4 pt-3 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}>
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

      {/* KJAPP Assist FAB — signaturknapp, alltid tilgjengelig */}
      {!menuOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 18 }}
          onClick={() => navigate("/app/ai")}
          data-testid="home-kjapp-assist"
          className="absolute right-4 z-[1001] group"
          style={{ bottom: sheetCollapsed ? 116 : 480 }}
          aria-label="KJAPP Assist"
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(203,163,101,0.55), transparent 70%)",
              filter: "blur(10px)",
              animation: "kjapp-fab-halo 3s ease-in-out infinite",
            }}
          />
          <div
            className="relative w-14 h-14 rounded-full grid place-items-center transition-transform group-active:scale-95"
            style={{
              background: "linear-gradient(135deg, #DDB77A 0%, #CBA365 55%, #8F6E3E 100%)",
              boxShadow: "0 12px 24px rgba(203,163,101,0.35), inset 0 0 0 1px rgba(255,255,255,0.15)",
            }}
          >
            <Sparkles size={22} style={{ color: "#0B1013" }} strokeWidth={2.4} />
          </div>
          <div
            className="absolute right-[68px] top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] tracking-widest uppercase pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(11,16,19,0.9)", color: "var(--accent)", border: "1px solid rgba(203,163,101,0.30)" }}
          >
            KJAPP Assist
          </div>
          <style>{`@keyframes kjapp-fab-halo { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }`}</style>
        </motion.button>
      )}

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
            background: "linear-gradient(180deg, rgba(16,23,28,0.94), rgba(9,14,18,0.97))",
            border: "1px solid rgba(232,224,208,0.12)",
            borderTop: "1px solid rgba(203,163,101,0.22)",
            backdropFilter: "blur(32px) saturate(150%)",
            WebkitBackdropFilter: "blur(32px) saturate(150%)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05) inset",
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
              {/* Signature search card — greeting + search + chips i én tappable enhet */}
              <button
                onClick={() => setShowSheet(true)}
                className="w-full text-left rounded-[22px] transition-transform active:scale-[0.99] relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(203,163,101,0.18) 0%, rgba(244,244,240,0.05) 44%, rgba(244,244,240,0.028) 100%)",
                  border: "1px solid rgba(203,163,101,0.30)",
                  padding: "18px 18px 16px",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset",
                }}
                data-testid="home-where-to"
              >
                <span className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(203,163,101,0.38), transparent 70%)", filter: "blur(4px)" }} />
                <div className="text-[10px] tracking-[0.34em] uppercase mb-1.5 relative" style={{ color: "var(--accent)" }} data-testid="home-greeting">
                  {getGreeting()}{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
                </div>
                <div className="flex items-center gap-3 relative">
                  <div className="font-display text-[30px] leading-[1.04] flex-1" style={{ color: "var(--text)" }}>
                    Hvor vil du?
                  </div>
                  <div
                    className="w-12 h-12 rounded-full grid place-items-center shrink-0 relative"
                    style={{ background: "linear-gradient(135deg, #DDB77A, #CBA365 55%, #8F6E3E)", boxShadow: "0 8px 22px rgba(203,163,101,0.42), inset 0 0 0 1px rgba(255,255,255,0.18)" }}
                  >
                    <span className="absolute inset-0 rounded-full" style={{ animation: "kjapp-search-ring 2.6s ease-out infinite" }} />
                    <Search size={18} style={{ color: "#0B1013" }} strokeWidth={2.6} />
                  </div>
                </div>
                {cars.length > 0 && (
                  <div className="text-[12px] mt-2 relative" style={{ color: "var(--text-secondary)" }} data-testid="home-smart-suggest">
                    Nærmeste bil er <span className="font-mono" style={{ color: "var(--accent)" }}>{cars[0]?.eta_min} min</span> unna
                  </div>
                )}
                <style>{`@keyframes kjapp-search-ring{0%{box-shadow:0 0 0 0 rgba(203,163,101,0.5);}70%{box-shadow:0 0 0 12px rgba(203,163,101,0);}100%{box-shadow:0 0 0 0 rgba(203,163,101,0);}}`}</style>
              </button>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "Hjem", target: places.find(p => p.label === "Hjem") },
                  { label: "Jobb", target: places.find(p => p.label === "Jobb") },
                  { label: "Flyplass", target: { name: "Oslo Lufthavn Gardermoen", lat: 60.1976, lng: 11.1004 } },
                ].map(({ label, target }) => {
                  const Ic = iconFor(label);
                  return (
                    <button
                      key={label}
                      onClick={(e) => { e.stopPropagation(); target && setDropoff({ name: target.name, lat: target.lat, lng: target.lng }); }}
                      disabled={!target}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-colors disabled:opacity-40 hover:border-mint"
                      style={{
                        background: "rgba(244,244,240,0.035)",
                        border: "1px solid rgba(244,244,240,0.08)",
                      }}
                      data-testid={`quick-${label}`}
                    >
                      <Ic size={16} style={{ color: "var(--accent)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 3-tier vehicle teaser — vises som preview før destinasjon er valgt */}
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: "var(--text-muted)" }}>Velg klasse</div>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TIERS.map((t, i) => (
                    <div
                      key={t.id}
                      className="rounded-[18px] p-3 text-center relative overflow-hidden"
                      style={{
                        background: i === 0
                          ? "linear-gradient(160deg, rgba(203,163,101,0.14), rgba(203,163,101,0.04))"
                          : "linear-gradient(160deg, rgba(244,244,240,0.055), rgba(244,244,240,0.02))",
                        border: `1px solid ${i === 0 ? "rgba(203,163,101,0.32)" : "rgba(244,244,240,0.09)"}`,
                        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
                      }}
                      data-testid={`tier-preview-${t.id}`}
                    >
                      <div className="w-full h-11 grid place-items-center">
                        <VehicleGlyph id={t.id} active={i === 0} />
                      </div>
                      <div className="text-[12px] mt-1.5 font-medium" style={{ color: "var(--text)" }}>{t.name}</div>
                      <div className="text-[9.5px] tracking-wide" style={{ color: "var(--text-muted)" }}>{t.tagline}</div>
                    </div>
                  ))}
                </div>
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
  const groups = [
    {
      label: "Din reise",
      items: [
        { label: "Profil", path: "/app/profile", Icon: User },
        { label: "Mine turer", path: "/app/history", Icon: History },
        { label: "Favoritter", path: "/app/favorites", Icon: Star },
        { label: "Betaling", path: "/app/payment-methods", Icon: CreditCard },
      ],
    },
    {
      label: "KJAPP-medlem",
      items: [
        { label: "KJAPP Rewards", path: "/app/rewards", Icon: Sparkles, badge: "Ny" },
        { label: "Sikkerhet", path: "/app/safety", Icon: SettingsIcon },
        { label: "Tilgjengelighet", path: "/app/accessibility", Icon: Users },
      ],
    },
    {
      label: "Verktøy",
      items: [
        { label: "KJAPP Assist", path: "/app/ai", Icon: Sparkles, tone: "accent" },
        { label: "Innstillinger", path: "/app/settings", Icon: SettingsIcon },
        { label: "Hjelp og støtte", path: "/app/help", Icon: HelpCircle },
      ],
    },
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
        initial={{ x: -340 }}
        animate={{ x: 0 }}
        exit={{ x: -340 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="absolute left-0 top-0 bottom-0 w-[300px] flex flex-col"
        style={{
          background: "rgba(11,16,19,0.98)",
          borderRight: "1px solid rgba(244,244,240,0.10)",
          boxShadow: "24px 0 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(244,244,240,0.08)" }}>
          <div className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "rgba(203,163,101,0.18)", color: "var(--accent)", fontWeight: 600 }}>
            {(userName || "K").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[17px]" style={{ color: "var(--text)" }}>{userName || "Gjest"}</div>
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>KJAPP-medlem</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(244,244,240,0.06)", color: "var(--text-muted)" }} data-testid="menu-close">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1.5 text-[9px] uppercase tracking-[0.35em]" style={{ color: "var(--text-muted)" }}>{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <button
                    key={it.path}
                    onClick={() => go(it.path)}
                    data-testid={`menu-${it.path.replace(/\//g, "-")}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-colors hover:bg-white/[0.03]"
                    style={{ background: "transparent", color: "var(--text)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl grid place-items-center"
                      style={{
                        background: it.tone === "accent" ? "rgba(203,163,101,0.15)" : "rgba(244,244,240,0.04)",
                        border: it.tone === "accent" ? "1px solid rgba(203,163,101,0.25)" : "1px solid transparent",
                      }}
                    >
                      <it.Icon size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <span className="text-sm flex-1">{it.label}</span>
                    {it.badge && (
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest"
                        style={{ background: "rgba(203,163,101,0.15)", color: "var(--accent)" }}
                      >
                        {it.badge}
                      </span>
                    )}
                    <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 space-y-2" style={{ borderTop: "1px solid rgba(244,244,240,0.08)" }}>
          <button
            onClick={() => go("/driver/login")}
            data-testid="menu-become-driver"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left"
            style={{ background: "rgba(203,163,101,0.06)", border: "1px solid rgba(203,163,101,0.16)" }}
          >
            <span className="text-[13px]" style={{ color: "var(--text)" }}>Bli KJAPP-sjåfør</span>
            <ChevronRight size={13} style={{ color: "var(--accent)" }} />
          </button>
          <button
            onClick={() => go("/apply/fleet")}
            data-testid="menu-become-loyver"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left"
            style={{ background: "rgba(203,163,101,0.06)", border: "1px solid rgba(203,163,101,0.16)" }}
          >
            <span className="text-[13px]" style={{ color: "var(--text)" }}>Bli løyvehaver</span>
            <ChevronRight size={13} style={{ color: "var(--accent)" }} />
          </button>
          <button
            onClick={() => { localStorage.removeItem("kjapp_token"); window.location.href = "/login"; }}
            data-testid="menu-logout"
            className="w-full flex items-center gap-2 justify-center py-2.5 rounded-2xl text-sm mt-2"
            style={{ background: "rgba(244,244,240,0.05)", color: "var(--text-muted)" }}
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
                <div className="font-mono text-[14px] font-semibold leading-none" style={{ color: active ? "var(--accent)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
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
        <span className="text-sm" style={{ color: "var(--text-muted)" }}><span className="font-mono" style={{ color: "var(--text-secondary)" }}>{distanceKm.toFixed(1)}</span> km · sjåfør kan hente deg om <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{selected.eta}</span> min</span>
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

/* Premium car glyph per category — metallic body, glossy glass, alloy rims, soft shadow */
function VehicleGlyph({ id, active }) {
  const uid = `vg-${id}${active ? "-a" : ""}`;
  const P = active
    ? { b1: "#f4e4bb", b2: "#c9a15b", b3: "#7c5d28", trim: "#fff4d6", rim: "#eeddb2", glassA: "#243545", glassB: "#0b1116", shadow: "rgba(201,161,91,0.45)", head: "#fff6df", belt: "#fff4d6" }
    : { b1: "#3c4650", b2: "#232c34", b3: "#12181d", trim: "#5c6772", rim: "#7a8590", glassA: "#1c242b", glassB: "#0b0f13", shadow: "rgba(0,0,0,0.5)", head: "#cdd6de", belt: "#4a545e" };

  const defs = (
    <defs>
      <linearGradient id={`${uid}-b`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.b1} /><stop offset="0.55" stopColor={P.b2} /><stop offset="1" stopColor={P.b3} />
      </linearGradient>
      <linearGradient id={`${uid}-g`} x1="0.1" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={P.glassA} /><stop offset="1" stopColor={P.glassB} />
      </linearGradient>
      <radialGradient id={`${uid}-s`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={P.shadow} /><stop offset="1" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
      <linearGradient id={`${uid}-r`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={P.rim} /><stop offset="1" stopColor={P.b3} />
      </linearGradient>
    </defs>
  );

  const wheel = (cx, r = 5.4) => (
    <g>
      <circle cx={cx} cy="35.5" r={r} fill="#05080a" />
      <circle cx={cx} cy="35.5" r={r - 0.6} fill="none" stroke={P.rim} strokeWidth="0.6" opacity="0.45" />
      <circle cx={cx} cy="35.5" r={r - 2.6} fill={`url(#${uid}-r)`} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 0.35} y="35.5" width="0.7" height={r - 2.7} fill={P.b3} opacity="0.7" transform={`rotate(${a} ${cx} 35.5)`} />
      ))}
      <circle cx={cx} cy="35.5" r="0.8" fill={P.rim} />
    </g>
  );

  let art;
  if (id === "premium") {
    art = (<>
      <path d="M5 27 C6 20 12 18 20 17 L30 12 C34 10 44 10 49 13 L56 18 C63 19 67 22 67 27 L67 31 C67 32.5 65.5 33 64 33 L8 33 C6.5 33 5 32.5 5 31 Z" fill={`url(#${uid}-b)`} stroke={P.trim} strokeWidth="0.6" />
      <path d="M23 17 L31 13 C34 11.5 43 11.5 47 14 L53 18 Z" fill={`url(#${uid}-g)`} />
      <path d="M8 27 L64 27" stroke={P.belt} strokeWidth="0.8" opacity="0.85" />
      <rect x="63.5" y="24.5" width="3.5" height="2.2" rx="1" fill={P.head} />
      {wheel(20)}{wheel(52)}
    </>);
  } else if (id === "trygg") {
    art = (<>
      <path d="M7 30 L7 20 C7 14 12 12 18 12 L52 12 C60 12 65 15 65 22 L65 30 C65 31.5 63.5 32 62 32 L9 32 C7.5 32 7 31.5 7 30 Z" fill={`url(#${uid}-b)`} stroke={P.trim} strokeWidth="0.6" />
      <rect x="6.5" y="10.6" width="20" height="1.2" rx="0.6" fill={P.trim} opacity="0.7" />
      <path d="M12 15 L23 15 L23 21 L12 21 Z" fill={`url(#${uid}-g)`} />
      <path d="M25 15 L37 15 L37 21 L25 21 Z" fill={`url(#${uid}-g)`} />
      <path d="M39 15 L52 15 C56 15 57 18 57 21 L39 21 Z" fill={`url(#${uid}-g)`} />
      <path d="M8 26 L64 26" stroke={P.belt} strokeWidth="0.8" opacity="0.85" />
      <rect x="61" y="23.5" width="4" height="2.4" rx="1" fill={P.head} />
      {wheel(21, 5.8)}{wheel(51, 5.8)}
    </>);
  } else if (id === "enkelt") {
    art = (<>
      <path d="M11 29 C12 22 17 20 24 19 L33 14 C36 12.5 44 12.5 48 15 L52 19 C58 20 60 23 60 29 L60 31 C60 32 58.5 32 57 32 L13 32 C11.5 32 11 31.5 11 29 Z" fill={`url(#${uid}-b)`} stroke={P.trim} strokeWidth="0.6" />
      <path d="M26 19 L34 15 C37 13.5 44 13.5 47 16 L50 19 Z" fill={`url(#${uid}-g)`} />
      <path d="M14 28 L58 28" stroke={P.belt} strokeWidth="0.8" opacity="0.85" />
      <rect x="57" y="25.5" width="3" height="2" rx="1" fill={P.head} />
      {wheel(23)}{wheel(49)}
      <path d="M35 21.5 L31.5 27 L34.2 27 L32.5 30.5 L37 24.5 L34.3 24.5 Z" fill="#7ee08a" />
    </>);
  } else {
    art = (<>
      <path d="M8 28 C9 21 15 19 22 18 L31 13 C35 11 45 11 50 14 L57 19 C63 20 65 23 65 28 L65 31 C65 32.5 63.5 33 62 33 L10 33 C8.5 33 8 32.5 8 31 Z" fill={`url(#${uid}-b)`} stroke={P.trim} strokeWidth="0.6" />
      <path d="M24 18 L32 14 C35 12.5 44 12.5 48 15 L54 19 Z" fill={`url(#${uid}-g)`} />
      <path d="M11 27 L63 27" stroke={P.belt} strokeWidth="0.8" opacity="0.85" />
      <rect x="62" y="24.5" width="3.4" height="2.2" rx="1" fill={P.head} />
      {wheel(22)}{wheel(51)}
    </>);
  }

  return (
    <svg viewBox="0 0 72 44" width="72" height="42" xmlns="http://www.w3.org/2000/svg">
      {defs}
      <ellipse cx="36" cy="40.5" rx="31" ry="3.2" fill={`url(#${uid}-s)`} />
      {art}
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
