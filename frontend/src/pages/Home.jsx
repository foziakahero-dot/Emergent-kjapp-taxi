import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PremiumMap from "../components/PremiumMap";
import { VehicleArt } from "../components/VehicleArt";
import { tripsApi, carsApi, placesApi, pricingApi, paymentApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Menu, Search, MapPin, Navigation, Home as HomeIcon, Briefcase, Star, CreditCard, ChevronRight, Users, Sparkles, ChevronUp, User, History, Settings as SettingsIcon, LogOut, HelpCircle, X, Plane } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const NAV_CLEARANCE = 84; // floating command bar height incl. margin

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState({ name: "Din posisjon", lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
  const [dropoff, setDropoff] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [vehicle, setVehicle] = useState("ai-first");
  const [requesting, setRequesting] = useState(false);
  const [cars, setCars] = useState([]);
  const [places, setPlaces] = useState(PLACES_FALLBACK);
  const [routeGeom, setRouteGeom] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null); // {distance_km, duration_min, options[]}
  const [surge, setSurge] = useState({ active: false, multiplier: 1.0, reasons: [] });
  const [pickupSheetOpen, setPickupSheetOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetH, setSheetH] = useState(420);
  const sheetRef = useRef(null);
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

  // Keep the Assist FAB floating just above the sheet regardless of its content height
  useEffect(() => {
    const node = sheetRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setSheetH(Math.round(entry.contentRect.height)));
    ro.observe(node);
    return () => ro.disconnect();
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
        navigate(`/app/booking/${t.trip_id}`);
      }
    }).catch(() => {});
  }, [navigate]);

  // get user's location if allowed
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setPickup({ name: "Din posisjon", lat, lng });
          // Resolve the real street name so the driver (and admin) get a usable pickup address
          placesApi.reverse(lat, lng)
            .then((r) => { if (r?.label) setPickup({ name: r.label, lat, lng }); })
            .catch(() => {});
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
    return cars.map((c) => ({ lat: c.lat, lng: c.lng, bearing: c.heading || 0, eta: c.eta_min }));
  }, [cars, dropoff]);

  const nearestEta = cars[0]?.eta_min;
  const firstName = user?.fullName ? user.fullName.split(" ")[0] : "";
  const sheetBottom = `calc(env(safe-area-inset-bottom) + ${NAV_CLEARANCE}px)`;

  return (
    <div className="relative" style={{ height: "100dvh" }} data-testid="home-screen">
      {/* Map — full bleed, Fjord & Granite vector style */}
      <div className="absolute inset-0">
        <PremiumMap
          center={[pickup.lng, pickup.lat]}
          zoom={dropoff ? 13.5 : 13.2}
          pitch={50}
          paddingBottom={sheetH + NAV_CLEARANCE}
          route={mapRoute}
          pickup={dropoff ? pickup : null}
          dropoff={dropoff}
          userPos={dropoff ? null : pickup}
          cars={nearbyCarsForMap}
          testid="home-map"
        />
        {/* Vignette — lets the crystal sheet and header float on the map */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,11,14,0.55) 0%, transparent 22%, transparent 55%, rgba(7,11,14,0.65) 100%)" }} />
      </div>

      {/* Top floating header — crystal pills */}
      <div className="relative z-[1000] px-4 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}>
        <motion.button
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="glass-pill w-11 h-11 grid place-items-center rounded-full transition-transform active:scale-95"
          data-testid="home-menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={18} style={{ color: "var(--text)" }} />
        </motion.button>
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="glass-pill flex flex-col items-center leading-none rounded-full px-6 py-2"
          data-testid="home-brand"
        >
          <span className="font-display text-[21px] tracking-[0.02em]" style={{ color: "var(--text)" }}>
            KJ<span style={{ color: "var(--accent)" }}>A</span>PP
          </span>
          <span className="text-[7.5px] tracking-[0.42em] uppercase mt-1" style={{ color: "rgba(203,163,101,0.85)" }}>Nordic taxi</span>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
          className="glass-pill w-11 h-11 grid place-items-center rounded-full transition-transform active:scale-95"
          data-testid="home-orb-btn"
          onClick={() => navigate("/app/ai")}
        >
          <div className="orb" style={{ width: 20, height: 20 }} />
        </motion.button>
      </div>

      {/* Customer side menu */}
      <AnimatePresence>
        {menuOpen && <CustomerMenu onClose={() => setMenuOpen(false)} navigate={navigate} userName={user?.fullName} />}
      </AnimatePresence>

      {/* KJAPP Assist FAB — brushed brass, floats above the sheet */}
      {!menuOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, type: "spring", stiffness: 220, damping: 18 }}
          onClick={() => navigate("/app/ai")}
          data-testid="home-kjapp-assist"
          className="absolute right-4 z-[1001] group"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + ${NAV_CLEARANCE + sheetH + 14}px)`, transition: "bottom 0.35s cubic-bezier(0.16,1,0.3,1)" }}
          aria-label="KJAPP Assist"
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(203,163,101,0.6), transparent 70%)", filter: "blur(12px)", animation: "kjapp-fab-halo 3s ease-in-out infinite" }}
          />
          <div className="brass-orb relative w-14 h-14">
            <Sparkles size={22} strokeWidth={2.4} />
          </div>
          <div
            className="absolute right-[68px] top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[11px] tracking-widest uppercase pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity glass-pill"
            style={{ color: "var(--accent)" }}
          >
            KJAPP Assist
          </div>
          <style>{`@keyframes kjapp-fab-halo { 0%,100% { opacity: 0.65; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }`}</style>
        </motion.button>
      )}

      {/* Crystal bottom sheet — search / booking (collapsible) */}
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 28, delay: 0.08 }}
        className="absolute left-0 right-0 z-[1000] px-3"
        style={{ bottom: sheetBottom }}
      >
        <div
          ref={sheetRef}
          className="relative overflow-hidden rounded-[28px]"
          data-testid="home-sheet"
          style={{
            background: "linear-gradient(180deg, rgba(14,22,28,0.90) 0%, rgba(8,13,17,0.97) 100%)",
            border: "1px solid rgba(244,244,240,0.10)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            boxShadow: "0 -14px 50px rgba(0,0,0,0.55), 0 30px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
            padding: "10px 14px 12px",
          }}
        >
          <span className="aurora-line" aria-hidden />
          {/* ambient fjord glow */}
          <span className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(123,166,158,0.14), transparent 70%)", filter: "blur(10px)" }} />

          {/* Collapse handle + toggle */}
          <button
            onClick={() => setSheetCollapsed((v) => !v)}
            data-testid="sheet-toggle"
            className="relative w-full flex flex-col items-center gap-1 pb-1 group"
            aria-label={sheetCollapsed ? "Åpne søk" : "Minimer søk"}
          >
            <div className="sheet-handle" style={{ margin: "0 auto 8px auto" }} />
          </button>

          {sheetCollapsed ? (
            <button
              onClick={() => setSheetCollapsed(false)}
              data-testid="sheet-expand"
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors"
              style={{ background: "rgba(244,244,240,0.045)", border: "1px solid rgba(244,244,240,0.10)" }}
            >
              <span className="live-dot" />
              <span className="flex-1 text-left text-[13px]" style={{ color: "var(--text)" }}>
                {cars.length > 0 ? `${cars.length} ${cars.length === 1 ? "bil" : "biler"} på vakt · nærmeste ${nearestEta} min` : "Ingen biler på vakt akkurat nå"}
              </span>
              <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          ) : (
            <div className="relative">
              {/* Pickup line — editable */}
              <button
                onClick={() => setPickupSheetOpen(true)}
                data-testid="home-edit-pickup"
                className="reveal w-full flex items-center gap-3 px-2 py-1.5 mb-3 text-left"
                style={{ animationDelay: "60ms" }}
              >
                <span className="relative w-3.5 h-3.5 shrink-0">
                  <span className="absolute inset-0 rounded-full" style={{ background: "rgba(203,163,101,0.35)", animation: "orbRing 2.2s ease-out infinite" }} />
                  <span className="absolute inset-[3px] rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 10px rgba(203,163,101,0.8)" }} />
                </span>
                <span className="text-[9.5px] uppercase tracking-[0.3em] shrink-0" style={{ color: "var(--text-muted)" }}>Hentes fra</span>
                <span className="flex-1 min-w-0 text-[13.5px] truncate" style={{ color: "var(--text)" }}>{pickup.name}</span>
                <span className="flex items-center gap-0.5 text-[11px] shrink-0" style={{ color: "var(--accent)" }}>Endre <ChevronRight size={12} /></span>
              </button>

              {!dropoff ? (
                <>
                  {/* Signature hero — greeting, editorial title, brass search orb, live radar */}
                  <button
                    onClick={() => setShowSheet(true)}
                    className="reveal w-full text-left relative overflow-hidden rounded-[26px] transition-transform active:scale-[0.99]"
                    style={{
                      animationDelay: "120ms",
                      background: "linear-gradient(135deg, #16232D 0%, #0E1820 52%, #0A1218 100%)",
                      border: "1px solid rgba(203,163,101,0.32)",
                      boxShadow: "0 24px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09)",
                      padding: "20px 20px 18px",
                    }}
                    data-testid="home-where-to"
                  >
                    <span className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(203,163,101,0.42), transparent 68%)", filter: "blur(6px)" }} />
                    <span className="pointer-events-none absolute -bottom-20 -left-10 w-44 h-44 rounded-full" style={{ background: "radial-gradient(circle, rgba(123,166,158,0.22), transparent 70%)", filter: "blur(8px)" }} />
                    <span className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(244,244,240,0.35), transparent)" }} />

                    <div className="relative text-[10px] tracking-[0.36em] uppercase mb-2" style={{ color: "var(--accent)" }} data-testid="home-greeting">
                      {getGreeting()}{firstName ? `, ${firstName}` : ""}
                    </div>
                    <div className="relative flex items-end justify-between gap-4">
                      <div className="font-display italic text-[40px] leading-[0.96] tracking-[-0.02em]" style={{ color: "var(--text)", fontWeight: 300 }}>
                        Hvor vil<br />du?
                      </div>
                      <div className="brass-orb w-[58px] h-[58px] shrink-0 mb-1">
                        <Search size={20} strokeWidth={2.6} />
                      </div>
                    </div>
                    <div className="relative mt-4 flex items-start gap-2.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }} data-testid="home-cars-nearby-status">
                      <span className="live-dot mt-1.5" style={cars.length === 0 ? { background: "#8A9198", boxShadow: "none" } : undefined} />
                      {cars.length > 0 ? (
                        <span data-testid="home-smart-suggest">
                          <span className="font-mono" style={{ color: "var(--text)" }}>{cars.length}</span> {cars.length === 1 ? "bil" : "biler"} på vakt · nærmeste{" "}
                          <span className="font-mono" style={{ color: "var(--accent)" }}>{nearestEta} min</span> unna
                        </span>
                      ) : (
                        <span data-testid="home-smart-suggest" className="leading-tight">
                          Ingen biler på vakt akkurat nå
                          <span className="block text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }} data-testid="home-cars-empty">
                            Kartet viser kun sjåfører med aktiv GPS
                          </span>
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Quick places — pill row */}
                  <div className="reveal mt-3 flex gap-2" style={{ animationDelay: "180ms" }}>
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
                          className="flex-1 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full transition-all disabled:opacity-40 active:scale-[0.97]"
                          style={{ background: "rgba(244,244,240,0.045)", border: "1px solid rgba(244,244,240,0.10)" }}
                          data-testid={`quick-${label}`}
                        >
                          <span className="w-8 h-8 rounded-full grid place-items-center shrink-0" style={{ background: "rgba(203,163,101,0.12)", border: "1px solid rgba(203,163,101,0.30)" }}>
                            <Ic size={14} style={{ color: "var(--accent)" }} />
                          </span>
                          <span className="text-[12.5px] truncate" style={{ color: "var(--text)" }}>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Showroom — 3-tier vehicle teaser */}
                  <div className="reveal mt-4" style={{ animationDelay: "240ms" }}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[9.5px] uppercase tracking-[0.32em]" style={{ color: "var(--text-muted)" }}>Velg klasse</span>
                      <span className="text-[9.5px] uppercase tracking-[0.2em]" style={{ color: "rgba(203,163,101,0.75)" }}>Nordisk komfort</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      {VEHICLE_TIERS.map((t, i) => {
                        const hero = i === 0;
                        return (
                          <div
                            key={t.id}
                            className="relative rounded-[20px] px-2 pt-4 pb-3 text-center overflow-hidden"
                            style={{
                              background: hero
                                ? "linear-gradient(180deg, rgba(203,163,101,0.18) 0%, rgba(203,163,101,0.04) 100%)"
                                : "linear-gradient(180deg, rgba(244,244,240,0.055) 0%, rgba(244,244,240,0.015) 100%)",
                              border: `1px solid ${hero ? "rgba(203,163,101,0.45)" : "rgba(244,244,240,0.09)"}`,
                              boxShadow: hero ? "0 12px 30px rgba(203,163,101,0.16), inset 0 1px 0 rgba(255,255,255,0.10)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
                            }}
                            data-testid={`tier-preview-${t.id}`}
                          >
                            {hero && (
                              <span className="absolute top-2 right-2 text-[7.5px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-full" style={{ background: "rgba(203,163,101,0.22)", color: "var(--accent)" }}>Populær</span>
                            )}
                            <span className="spotlight" style={{ bottom: 44, background: hero ? "radial-gradient(ellipse, rgba(203,163,101,0.45), transparent 70%)" : "radial-gradient(ellipse, rgba(244,244,240,0.14), transparent 70%)" }} />
                            <VehicleArt id={t.id} active={hero} height={56} className="-mx-2 -mt-4 mb-1 rounded-t-[20px]" />
                            <div className="font-display text-[15px] mt-1.5 leading-none" style={{ color: "var(--text)" }}>{t.name}</div>
                            <div className="text-[9px] tracking-[0.06em] uppercase mt-1" style={{ color: "var(--text-muted)" }}>{t.tagline}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 text-center text-[8.5px] tracking-[0.12em] uppercase" style={{ color: "rgba(138,145,152,0.55)" }}>
                    Kart © OpenStreetMap · OpenMapTiles · OpenFreeMap
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
                  surge={surge}
                />
              )}
            </div>
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
        className="absolute left-0 top-0 bottom-0 w-[300px] flex flex-col overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(14,22,28,0.98), rgba(7,11,14,0.99))",
          borderRight: "1px solid rgba(244,244,240,0.10)",
          boxShadow: "24px 0 48px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="aurora-line" aria-hidden />
        <div className="px-5 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(244,244,240,0.08)" }}>
          <div className="w-11 h-11 rounded-full grid place-items-center font-display text-[16px]" style={{ background: "linear-gradient(140deg, rgba(203,163,101,0.32), rgba(203,163,101,0.10))", border: "1px solid rgba(203,163,101,0.45)", color: "var(--accent)" }}>
            {(userName || "K").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[18px]" style={{ color: "var(--text)" }}>{userName || "Gjest"}</div>
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


function BookingReview({ pickup, dropoff, vehicle, onVehicleChange, distanceKm, estPrice, options, onCancel, onConfirm, requesting, hasPaymentMethod, hasVerifiedPaymentMethod, defaultMethod, defaultMethodVerified, onAddCard, surge }) {
  const selected = VEHICLES.find((v) => v.id === vehicle) || VEHICLES[0];
  const priceFor = (vid) => (options?.find?.((o) => o.vehicle_type === vid)?.price) || 0;
  return (
    <div className="reveal" data-testid="booking-review">
      {/* Route endpoints */}
      <div
        className="flex items-center gap-3 mb-3 px-3 py-3 rounded-[20px]"
        style={{ background: "linear-gradient(135deg, rgba(22,35,45,0.75), rgba(10,18,24,0.6))", border: "1px solid rgba(244,244,240,0.09)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
      >
        <div className="flex flex-col items-center pt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 10px rgba(203,163,101,0.8)" }} />
          <div className="w-px h-8 my-0.5" style={{ background: "linear-gradient(180deg, rgba(203,163,101,0.6), rgba(244,244,240,0.35))" }} />
          <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--text)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Hentes fra</div>
          <div className="text-[13.5px] truncate" style={{ color: "var(--text)" }}>{pickup.name}</div>
          <div className="text-[9.5px] uppercase tracking-[0.28em] mt-2" style={{ color: "var(--text-muted)" }}>Kjøres til</div>
          <div className="text-[13.5px] truncate" style={{ color: "var(--text)" }}>{dropoff.name}</div>
        </div>
        <button
          onClick={onCancel}
          className="text-[11px] px-3 py-1.5 rounded-full shrink-0"
          style={{ color: "var(--accent)", border: "1px solid rgba(203,163,101,0.35)", background: "rgba(203,163,101,0.08)" }}
          data-testid="booking-cancel"
        >
          Endre
        </button>
      </div>

      {/* Showroom vehicle picker — snap-scroll */}
      <div className="-mx-4 px-4 mb-3 flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth" style={{ scrollSnapType: "x mandatory" }}>
        {VEHICLES.map((v) => {
          const active = vehicle === v.id;
          const price = priceFor(v.id);
          return (
            <button
              key={v.id}
              onClick={() => onVehicleChange(v.id)}
              data-testid={`vehicle-${v.id}`}
              className="shrink-0 rounded-[20px] p-3 pt-4 relative overflow-hidden text-left"
              style={{
                minWidth: 148,
                background: active
                  ? "linear-gradient(180deg, rgba(203,163,101,0.20), rgba(203,163,101,0.05))"
                  : "linear-gradient(180deg, rgba(244,244,240,0.05), rgba(244,244,240,0.015))",
                border: `1px solid ${active ? "rgba(203,163,101,0.6)" : "rgba(244,244,240,0.09)"}`,
                boxShadow: active ? "0 12px 34px rgba(203,163,101,0.22), inset 0 1px 0 rgba(255,255,255,0.10)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
                scrollSnapAlign: "start",
                transition: "border-color 0.15s ease, box-shadow 0.25s ease, background 0.25s ease",
              }}
            >
              <span className="spotlight" style={{ bottom: 62, background: active ? "radial-gradient(ellipse, rgba(203,163,101,0.5), transparent 70%)" : "radial-gradient(ellipse, rgba(244,244,240,0.14), transparent 70%)" }} />
              <VehicleArt id={v.id} active={active} height={68} className="-mx-3 -mt-4 mb-2 rounded-t-[20px]" />
              <div className="flex items-baseline justify-between mb-0.5">
                <div className="font-display text-[15px]" style={{ color: "var(--text)" }}>{v.name}</div>
                <div className="text-[8.5px] tracking-[0.2em] uppercase" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{v.tagline}</div>
              </div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{v.desc}</div>
              <div className="flex items-center justify-between mt-2.5 pt-2" style={{ borderTop: "1px solid rgba(244,244,240,0.08)" }}>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <Users size={11} /> {v.capacity}
                </div>
                <div className="font-mono text-[14px] font-semibold leading-none" style={{ color: active ? "var(--accent)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {price} kr
                </div>
              </div>
              {active && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full grid place-items-center" style={{ background: "linear-gradient(140deg, #EED9A6, #CBA365)", boxShadow: "0 4px 10px rgba(203,163,101,0.5)" }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M5 12l5 5L20 7" stroke="#070B0E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-end justify-between mb-3 px-1">
        <div className="text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{distanceKm.toFixed(1)}</span> km<br />
          sjåfør kan hente deg om <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{selected.eta}</span> min
        </div>
        <div className="text-right">
          <div className="text-[9.5px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Ca. pris</div>
          <div className="font-display text-[32px] leading-none mt-0.5" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }} data-testid="booking-price">
            {estPrice} <span className="text-[16px]" style={{ color: "var(--accent)" }}>kr</span>
          </div>
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
        className="btn-brass flex items-center justify-center gap-2"
      >
        {requesting ? (
          <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#070B0E", borderTopColor: "transparent" }} />
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

/* Payment row with verification pill */
function PaymentRow({ hasPaymentMethod, hasVerified, defaultMethod, defaultMethodVerified, onAddCard }) {
  return (
    <button
      onClick={onAddCard}
      data-testid="booking-payment-row"
      className="w-full mb-3 flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-left"
      style={{ background: "rgba(244,244,240,0.045)", border: "1px solid rgba(244,244,240,0.09)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(203,163,101,0.14)", border: "1px solid rgba(203,163,101,0.28)" }}>
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
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(123,224,184,0.14)", color: "#7BE0B8" }}>Verifisert</span>
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
      style={{ background: "linear-gradient(180deg, rgba(10,16,21,0.97), rgba(7,11,14,0.99))", backdropFilter: "blur(20px)" }}
    >
      <span className="aurora-line" aria-hidden style={{ top: "max(env(safe-area-inset-top), 0px)" }} />
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        exit={{ y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="p-6 pt-14"
      >
        <div className="text-[10px] tracking-[0.36em] uppercase mb-2 px-1" style={{ color: "var(--accent)" }}>Destinasjon</div>
        <div className="font-display italic text-[30px] leading-none mb-5 px-1" style={{ color: "var(--text)", fontWeight: 300 }}>Hvor vil du?</div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="glass-pill w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ color: "var(--text-muted)" }} data-testid="search-close" aria-label="Lukk"><X size={16} /></button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--accent)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: 42, borderRadius: 999, background: "rgba(244,244,240,0.05)" }}
              placeholder="Skriv en adresse i Norge…"
              data-testid="search-input"
            />
          </div>
        </div>
        <div className="space-y-2 max-h-[62vh] overflow-y-auto no-scrollbar">
          {local.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest px-2 mt-1" style={{ color: "var(--text-muted)" }}>Favoritter</div>
          )}
          {local.map((p) => (
            <button
              key={"local-" + p.name}
              onClick={() => onPick(p)}
              data-testid={`search-result-${p.name}`}
              className="w-full flex items-center gap-4 p-4 rounded-2xl transition-colors text-left"
              style={{ background: "rgba(244,244,240,0.045)", border: "1px solid rgba(244,244,240,0.09)" }}
            >
              <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(203,163,101,0.14)", border: "1px solid rgba(203,163,101,0.3)" }}>
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
              style={{ background: "rgba(244,244,240,0.045)", border: "1px solid rgba(244,244,240,0.09)" }}
            >
              <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(203,163,101,0.14)", border: "1px solid rgba(203,163,101,0.3)" }}>
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
