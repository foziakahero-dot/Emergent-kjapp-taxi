import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi, tripsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Check, Power, Phone, Star, MessageCircle, Wallet, Clock, ShieldAlert, ChevronRight, Home as HomeIcon, User as UserIcon, TrendingUp } from "lucide-react";
import { playNewTripPing, primeAudioOnUserGesture } from "../lib/sound";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { carIconRotated } from "../lib/mapAssets";
import L from "leaflet";

function notifyNewTrip(count) {
  // Best-effort browser notification (works in background tab)
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(`Ny tur${count > 1 ? "er" : ""} tilgjengelig`, {
        body: `${count} ny${count > 1 ? "e" : ""} tur${count > 1 ? "er" : ""} venter på deg — trykk for å godta`,
        icon: "/logo.png",
        tag: "kjapp-new-trip",
        renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* ignore */ }
}

function RecenterOn({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.setView([lat, lng], 14, { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function DriverHome() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [current, setCurrent] = useState(null);
  const [summary, setSummary] = useState({ income: 0, trips: 0, satisfaction: 98 });
  const [accepting, setAccepting] = useState(null);
  const [online, setOnline] = useState(() => localStorage.getItem("kjapp_driver_online") === "true");
  const [gpsError, setGpsError] = useState(null);
  const [pos, setPos] = useState(null); // {lat, lng, heading}
  const watchIdRef = useRef(null);
  const prevPendingIdsRef = useRef(new Set());
  const navigate = useNavigate();

  // Prime audio unlock on first user gesture (mobile browsers block autoplay)
  useEffect(() => { primeAudioOnUserGesture(); }, []);

  const load = async () => {
    try {
      const [p, c, s] = await Promise.all([driverApi.pending(), driverApi.current(), driverApi.summary()]);
      const trips = p.trips || [];
      const currentIds = new Set(trips.map((t) => t.trip_id));
      const prev = prevPendingIdsRef.current;
      const newOnes = [...currentIds].filter((id) => !prev.has(id));
      if (newOnes.length > 0 && online) {
        if (prevPendingIdsRef.current.__initialized) {
          // Triple ping + vibration + browser notification for new trips (harder to miss)
          try {
            playNewTripPing();
            setTimeout(() => { try { playNewTripPing(); } catch { /* audio blocked */ } }, 700);
            setTimeout(() => { try { playNewTripPing(); } catch { /* audio blocked */ } }, 1400);
          } catch { /* blocked */ }
          try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch { /* vibrate unsupported */ }
          notifyNewTrip(newOnes.length);
        }
      }
      currentIds.__initialized = true;
      prevPendingIdsRef.current = currentIds;
      setPending(trips);
      setCurrent(c);
      setSummary(s);
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // Start / stop GPS heartbeat when online toggled
  useEffect(() => {
    localStorage.setItem("kjapp_driver_online", String(online));
    driverApi.online(online).catch(() => {});
    let handle = null;
    let lastSent = 0;
    (async () => {
      if (online) {
        const { watchLocation } = await import("../lib/native");
        handle = await watchLocation(
          (p) => {
            setGpsError(null);
            setPos({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading || 0 });
            const now = Date.now();
            if (now - lastSent < 4500) return;  // throttle ~5s
            lastSent = now;
            driverApi.location(p.coords.latitude, p.coords.longitude, p.coords.heading, p.coords.speed).catch(() => {});
          },
          (err) => { setGpsError("GPS-feil: " + (err?.message || "ukjent")); },
        );
        watchIdRef.current = handle;
      }
    })();
    return () => {
      if (watchIdRef.current?.clear) watchIdRef.current.clear();
      watchIdRef.current = null;
    };
  }, [online]);

  const accept = async (trip_id) => {
    setAccepting(trip_id);
    try {
      await driverApi.accept(trip_id);
      await load();
      navigate("/driver/trip");
    } catch (e) {
      alert("Turen ble tatt av en annen sjåfør.");
      await load();
    } finally {
      setAccepting(null);
    }
  };

  const declineTrip = async (trip_id) => {
    // Optimistic remove — driver won't see this trip again
    setPending((prev) => prev.filter((t) => t.trip_id !== trip_id));
    try { await driverApi.decline(trip_id); } catch { /* ignore — server may not have endpoint yet */ }
  };

  const firstName = (user?.fullName || "Sjåfør").split(" ")[0];
  const greeting = greetingFor(new Date());
  const summaryText = summaryLine(summary);

  return (
    <div className="px-4 pt-2 pb-24 page-enter">
      {/* 1. STATUS — Online / Offline med tydelig kopi + pulserende ring */}
      <div className="mt-2 card p-4 flex items-center gap-3" data-testid="driver-status-card">
        <div
          className="relative w-11 h-11 rounded-full grid place-items-center shrink-0"
          style={{ background: online ? "rgba(47,224,140,0.14)" : "rgba(255,255,255,0.04)" }}
        >
          {online && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(47,224,140,0.42), transparent 65%)",
                animation: "kjapp-online-pulse 2.4s ease-out infinite",
              }}
            />
          )}
          <Power size={18} className="relative" style={{ color: online ? "#2fe08c" : "var(--text-muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[17px]" style={{ color: "var(--text)" }} data-testid="driver-status-title">
            {online ? "Online" : "Offline"}
          </div>
          <div className="text-[12px]" style={{ color: online ? "#2fe08c" : "var(--text-muted)" }}>
            {online ? (gpsError ? gpsError : "Du mottar turforespørsler") : "Slå på for å motta turer"}
          </div>
        </div>
        <button
          onClick={() => setOnline((v) => !v)}
          data-testid="driver-online-toggle"
          aria-label={online ? "Gå offline" : "Gå online"}
          aria-pressed={online}
          className="relative w-16 h-9 rounded-full transition-colors shrink-0"
          style={{
            background: online ? "#2fe08c" : "rgba(255,255,255,0.10)",
            boxShadow: online ? "inset 0 0 0 1px rgba(47,224,140,0.5)" : "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="absolute top-1 left-1 w-7 h-7 rounded-full transition-transform"
            style={{
              background: online ? "#0B1013" : "#F4F4F0",
              transform: online ? "translateX(28px)" : "translateX(0)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            }}
          />
        </button>
        <style>{`@keyframes kjapp-online-pulse { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(1.9); opacity: 0; } }`}</style>
      </div>

      {/* 2. DRIVER OVERVIEW — God kveld + turer + inntekt */}
      <div className="mt-3 card p-4" data-testid="driver-overview">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-soft))" }} data-testid="driver-avatar">
            {user?.photo ? (
              <img src={user.photo} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <span style={{ color: "var(--accent-on)", fontWeight: 600 }}>
                {(user?.fullName || "S").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>
              {greeting}, {firstName}
            </div>
            <div className="font-display text-[19px] leading-tight mt-0.5" style={{ color: "var(--text)" }} data-testid="driver-overview-headline">
              {summaryText}
            </div>
            {current && (
              <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }} data-testid="driver-overview-active">
                Du har 1 aktiv tur
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>I dag</div>
            <div className="font-display text-[18px]" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }} data-testid="driver-overview-income">{summary.income} kr</div>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE TRIP — prominent card med status og CTA */}
      {current && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="driver-active-card"
          className="mt-3 card p-4"
          style={{ border: "1px solid rgba(203,163,101,0.34)", boxShadow: "0 12px 32px rgba(203,163,101,0.10)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
              <span className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "var(--accent)" }} data-testid="active-badge">AKTIV TUR</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }} data-testid="active-state">
              {activeStateLabel(current.status)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: "var(--accent-soft)" }}>
              <Navigation size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" style={{ color: "var(--text)" }} data-testid="active-address">
                {current.status === "driver_on_way" ? current.pickup_address : current.dropoff_address}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {current.customer?.name || "Kunde"} · {current.distance_km} km
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-[17px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{current.price} kr</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/driver/trip")}
            data-testid="active-open"
            className="mt-3 btn-primary w-full flex items-center justify-center gap-2"
          >
            Åpne aktiv tur <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {/* 4. INCOMING TRIP REQUESTS — passasjer, rating, henting/destinasjon, inntekt */}
      <div className="mt-6" data-testid="pending-list">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Neste tur</h2>
          {pending.length > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }} data-testid="pending-count">{pending.length} venter</span>
          )}
        </div>
        <AnimatePresence>
          {pending.length === 0 ? (
            <div className="card p-8 text-center" data-testid="no-pending">
              <div className="text-[13px]" style={{ color: "var(--text)" }}>
                {online ? "Vi varsler deg når det kommer en tur." : "Slå på for å motta turer."}
              </div>
              {!online && (
                <button
                  onClick={() => setOnline(true)}
                  data-testid="no-pending-go-online"
                  className="btn-primary mt-4"
                >
                  Gå online
                </button>
              )}
            </div>
          ) : (
            pending.map((t) => (
              <TripRequestCard
                key={t.trip_id}
                trip={t}
                pos={pos}
                accepting={accepting === t.trip_id}
                onAccept={() => accept(t.trip_id)}
                onDecline={() => declineTrip(t.trip_id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 8. DRIVER EARNINGS — compact 4-metric summary */}
      <button
        onClick={() => navigate("/driver/payouts")}
        data-testid="earnings-summary"
        className="mt-6 w-full text-left rounded-2xl p-4"
        style={{ background: "rgba(244,244,240,0.03)", border: "1px solid rgba(244,244,240,0.08)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>Sammendrag</div>
          <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Metric label="I dag" value={`${summary.income} kr`} testid="metric-income" />
          <Metric label="Turer" value={summary.trips} testid="metric-trips" />
          <Metric label="Online" value={formatOnlineTime(summary.online_minutes || 0)} testid="metric-online-time" />
          <Metric label="Godta-rate" value={`${summary.acceptance_rate ?? 92}%`} testid="metric-acceptance" />
        </div>
      </button>

      {/* 9. BOTTOM NAV — Home, Earnings, Trips, Account */}
      <DriverBottomNav />
    </div>
  );
}

/** Trip request card med countdown + tydelig kunde-info + Godta/Avslå */
function TripRequestCard({ trip, pos, accepting, onAccept, onDecline }) {
  const [remaining, setRemaining] = useState(15);
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  useEffect(() => {
    if (remaining === 0) onDecline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const distToPickup = pos ? haversineKm(pos.lat, pos.lng, trip.pickup_lat, trip.pickup_lng) : null;
  const pct = (remaining / 15) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="card p-4 mb-3"
      data-testid={`pending-${trip.trip_id}`}
    >
      {/* Countdown progress bar (top of card) */}
      <div className="h-[3px] rounded-full mb-3" style={{ background: "rgba(244,244,240,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: remaining <= 5
              ? "linear-gradient(90deg, #d76a5a, #e0956a)"
              : "linear-gradient(90deg, var(--accent), #DDB77A)",
          }}
        />
      </div>

      {/* Passenger identity */}
      {trip.customer && (
        <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div
            className="w-11 h-11 rounded-full grid place-items-center font-medium text-sm shrink-0"
            style={{ background: "linear-gradient(135deg, var(--accent-soft), rgba(244,244,240,0.04))", color: "var(--accent)" }}
            data-testid={`pending-customer-${trip.trip_id}`}
          >
            {trip.customer.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[15px] font-medium truncate">{trip.customer.name}</div>
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              <Star size={11} className="text-mint" fill="currentColor" />
              <span style={{ color: "var(--accent)" }}>{trip.customer.rating?.toFixed(1) || "4.9"}</span>
              {trip.customer.trip_count > 0 && <span>· {trip.customer.trip_count} turer</span>}
            </div>
          </div>
          {trip.customer.phone && (
            <a
              href={`tel:${trip.customer.phone}`}
              onClick={(e) => e.stopPropagation()}
              data-testid={`pending-call-${trip.trip_id}`}
              className="w-10 h-10 rounded-full grid place-items-center transition-colors shrink-0"
              style={{ background: "var(--accent-soft)", border: "1px solid rgba(203,163,101,0.25)", color: "var(--accent)" }}
              aria-label={`Ring ${trip.customer.name}`}
            >
              <Phone size={16} />
            </a>
          )}
        </div>
      )}

      {/* Pickup + destination — clearly separated */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: "var(--accent)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Henting</div>
            <div className="text-[14px] truncate" style={{ color: "var(--text)" }}>{trip.pickup_address}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-sm mt-2 shrink-0" style={{ background: "#F4F4F0" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Destinasjon</div>
            <div className="text-[14px] truncate" style={{ color: "var(--text)" }}>{trip.dropoff_address}</div>
          </div>
        </div>
      </div>

      {/* Distances */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl p-2.5" style={{ background: "rgba(244,244,240,0.03)" }}>
          <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Til henting</div>
          <div className="text-[13px] mt-0.5" style={{ color: "var(--text)" }} data-testid={`pickup-dist-${trip.trip_id}`}>
            {distToPickup != null ? `${distToPickup.toFixed(1)} km` : "—"}
            <span className="opacity-50"> · </span>
            {distToPickup != null ? `${Math.max(1, Math.round(distToPickup / 0.7))} min` : "—"}
          </div>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: "rgba(244,244,240,0.03)" }}>
          <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Selve turen</div>
          <div className="text-[13px] mt-0.5" style={{ color: "var(--text)" }}>
            {trip.distance_km} km <span className="opacity-50">·</span> {trip.duration_min} min
          </div>
        </div>
      </div>

      {/* Estimated driver earnings — prominent */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Din inntjening</div>
        <div className="font-display text-[26px] leading-none" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }} data-testid={`earn-${trip.trip_id}`}>
          {Math.round((trip.price || 0) * 0.9)} kr
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        <button
          onClick={onDecline}
          disabled={accepting}
          data-testid={`decline-${trip.trip_id}`}
          className="w-[38%] rounded-full py-3 text-[13px] transition-colors disabled:opacity-50"
          style={{ background: "rgba(244,244,240,0.04)", border: "1px solid var(--line)", color: "var(--text-muted)" }}
        >
          Avslå
        </button>
        <button
          onClick={onAccept}
          disabled={accepting}
          data-testid={`accept-${trip.trip_id}`}
          className="flex-1 btn-primary flex flex-col items-center justify-center py-2 disabled:opacity-50"
        >
          {accepting ? (
            <span className="w-4 h-4 border-2 border-[#0B1013] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-medium"><Check size={16} /> Godta tur</span>
              <span className="text-[10px] uppercase tracking-widest opacity-80 mt-0.5">Godta innen {remaining} sek</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/** 9. Bottom navigation — 4 items only for one-hand driving */
function DriverBottomNav() {
  const navigate = useNavigate();
  const location = typeof window !== "undefined" ? window.location.pathname : "";
  const items = [
    { key: "home", label: "Hjem", Icon: HomeIcon, path: "/driver", match: (p) => p === "/driver" || p === "/driver/" },
    { key: "earn", label: "Inntekt", Icon: TrendingUp, path: "/driver/payouts", match: (p) => p.startsWith("/driver/payouts") },
    { key: "trips", label: "Turer", Icon: Clock, path: "/driver/history", match: (p) => p.startsWith("/driver/history") },
    { key: "account", label: "Konto", Icon: UserIcon, path: "/driver/profile", match: (p) => p.startsWith("/driver/profile") },
  ];
  return (
    <div
      className="fixed left-0 right-0 z-[900] flex items-center justify-around px-2"
      style={{
        bottom: 0,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: 8,
        background: "rgba(11,16,19,0.94)",
        backdropFilter: "blur(24px) saturate(140%)",
        borderTop: "1px solid rgba(244,244,240,0.06)",
      }}
      data-testid="driver-bottom-nav"
    >
      {items.map((it) => {
        const active = it.match(location);
        return (
          <button
            key={it.key}
            onClick={() => navigate(it.path)}
            data-testid={`dnav-${it.key}`}
            className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors"
            style={{ minWidth: 64 }}
          >
            <it.Icon size={20} style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[10px]" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Helpers */
function greetingFor(d) {
  const h = d.getHours();
  if (h < 5) return "God natt";
  if (h < 10) return "God morgen";
  if (h < 12) return "God formiddag";
  if (h < 17) return "God ettermiddag";
  if (h < 22) return "God kveld";
  return "God natt";
}

function summaryLine(summary) {
  const trips = summary.trips ?? 0;
  if (trips === 0) return "Ingen turer i dag ennå.";
  if (trips === 1) return "1 tur fullført i dag";
  return `${trips} turer fullført i dag`;
}

function activeStateLabel(status) {
  if (status === "driver_on_way") return "På vei til kunde";
  if (status === "arrived") return "Venter på kunde";
  if (status === "in_trip") return "Tur pågår";
  return "Aktiv";
}

function formatOnlineTime(min) {
  if (!min) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} t ${m} min` : `${m} min`;
}

function Metric({ label, value, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-[9px] uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-display text-[15px] leading-tight mt-0.5" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}


function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lat2 == null) return 0;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

