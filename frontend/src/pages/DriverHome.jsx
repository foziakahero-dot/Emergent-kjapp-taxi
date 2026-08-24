import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi, tripsApi } from "../lib/api";
import { Orb, VoiceBars } from "../components/UIKit";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Clock, Check, Power, History, Phone, Star } from "lucide-react";
import { playNewTripPing, primeAudioOnUserGesture } from "../lib/sound";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { carIconRotated, pickupIcon, dropoffIcon } from "../lib/mapAssets";
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

  const firstName = (user?.fullName || "Sjåfør").split(" ")[0];

  return (
    <div className="px-4 pt-2 pb-24 page-enter">
      {/* Online toggle */}
      <div className="mt-2 card p-4 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full grid place-items-center"
          style={{ background: online ? "rgba(47,224,140,0.15)" : "rgba(255,255,255,0.05)" }}
        >
          <Power size={18} className={online ? "text-mint" : ""} style={!online ? { color: "var(--text-muted)" } : undefined} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{online ? "På vakt" : "Offline"}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{online ? (gpsError || "Du mottar turer") : "Slå på for å motta turer"}</div>
        </div>
        <button
          onClick={() => setOnline((v) => !v)}
          data-testid="driver-online-toggle"
          className="relative w-14 h-8 rounded-full transition-colors"
          style={{ background: online ? "#2fe08c" : "rgba(255,255,255,0.10)" }}
          aria-pressed={online}
        >
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${online ? "translate-x-6" : ""}`} />
        </button>
      </div>

      {/* Live map — only when online + has GPS */}
      {online && pos && (
        <div className="mt-3 card overflow-hidden" data-testid="driver-live-map">
          <div className="relative h-[220px] w-full">
            <MapContainer
              center={[pos.lat, pos.lng]}
              zoom={14}
              zoomControl={false}
              attributionControl={false}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png" />
              <Marker position={[pos.lat, pos.lng]} icon={carIconRotated(pos.heading || 0)} />
              <RecenterOn lat={pos.lat} lng={pos.lng} />
            </MapContainer>
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
              <span className="text-white text-[11px] font-medium tracking-wide">LIVE POSISJON</span>
            </div>
          </div>
        </div>
      )}

      {/* Hero — with driver avatar */}
      <div className="mt-3 card p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-40 pointer-events-none">
          <div className="orb" style={{ width: 130, height: 130 }} />
        </div>
        <div className="relative flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mint to-[#0e8a55] grid place-items-center text-[#04120a] font-display text-lg shrink-0 mint-glow" data-testid="driver-avatar">
            {user?.photo ? (
              <img src={user.photo} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              (user?.fullName || "S").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-mint uppercase tracking-widest">
              {user?.car || "Sjåfør"} {user?.plate ? ` · ${user.plate}` : ""}
            </div>
            <h1 className="mt-1 font-display text-[20px] tracking-tight text-white leading-tight">
              Hei {firstName}.<br />
              {pending.length > 0 || current
                ? `${pending.length + (current ? 1 : 0)} tur${pending.length + (current ? 1 : 0) === 1 ? "" : "er"} nå.`
                : online ? "Ingen turer akkurat nå." : "Slå på for å begynne."}
            </h1>
            <p className="text-[#7a827a] text-sm mt-1">
              {current ? "Du har en aktiv tur." : pending.length ? "Klar til å kjøre?" : online ? "Vi varsler deg når det kommer en tur." : "Du er offline."}
            </p>
          </div>
        </div>
      </div>

      {/* Current trip banner */}
      {current && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate("/driver/trip")}
          data-testid="driver-current-banner"
          className="mt-3 w-full text-left card p-4 flex items-center gap-3 border-mint/40"
        >
          <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
            <Navigation size={18} className="text-mint" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-mint uppercase tracking-widest">Aktiv tur</div>
            <div className="text-white text-sm truncate mt-0.5">{current.dropoff_address}</div>
          </div>
          <div className="text-white text-sm font-semibold">{current.price} kr</div>
        </motion.button>
      )}

      {/* Next / pending trips */}
      <div className="mt-5 px-1 flex items-center justify-between">
        <h2 className="text-white text-sm font-medium">Neste tur</h2>
        <span className="text-[11px] text-[#7a827a]">{pending.length} venter</span>
      </div>

      <div className="mt-2 space-y-2">
        <AnimatePresence>
          {pending.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 text-center">
              <Orb size="small" />
              <div className="text-[#7a827a] text-sm mt-3">Ingen turer venter</div>
              <div className="text-[11px] text-[#5f6862] mt-1">Turer dukker opp automatisk her</div>
            </motion.div>
          ) : (
            pending.map((t) => (
              <motion.div
                key={t.trip_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="card p-4"
                data-testid={`pending-${t.trip_id}`}
              >
                {/* Customer chip */}
                {t.customer && (
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-line">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mint/25 to-mint/5 grid place-items-center text-mint font-medium text-[13px]" data-testid={`pending-customer-${t.trip_id}`}>
                      {t.customer.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{t.customer.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#a8b0a8] mt-0.5">
                        <Star size={11} className="text-mint" fill="#2fe08c" />
                        <span>{t.customer.rating?.toFixed(1) || "4.9"}</span>
                        {t.customer.trip_count > 0 && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>{t.customer.trip_count} turer</span>
                          </>
                        )}
                      </div>
                    </div>
                    {t.customer.phone && (
                      <a
                        href={`tel:${t.customer.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`pending-call-${t.trip_id}`}
                        className="w-9 h-9 rounded-full bg-mint/10 border border-mint/20 grid place-items-center text-mint hover:bg-mint/20 transition-colors"
                        aria-label={`Ring ${t.customer.name}`}
                      >
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2 h-2 rounded-full bg-mint" />
                    <div className="w-px h-6 bg-[#263038]" />
                    <div className="w-2 h-2 rounded-sm bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#7a827a]">Henting</div>
                    <div className="text-white text-sm truncate">{t.pickup_address}</div>
                    <div className="text-[11px] text-[#7a827a] mt-1">Til</div>
                    <div className="text-white text-sm truncate">{t.dropoff_address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[#a8b0a8] mb-3 border-t border-line pt-2">
                  <span>{t.distance_km} km</span>
                  <span>·</span>
                  <span>{t.duration_min} min</span>
                  {pos && (
                    <>
                      <span>·</span>
                      <span data-testid={`pickup-dist-${t.trip_id}`}>
                        {haversineKm(pos.lat, pos.lng, t.pickup_lat, t.pickup_lng).toFixed(1)} km til henting
                      </span>
                    </>
                  )}
                  <span className="ml-auto text-white font-semibold text-base">{t.price} kr</span>
                </div>
                <button
                  onClick={() => accept(t.trip_id)}
                  disabled={accepting === t.trip_id}
                  data-testid={`accept-${t.trip_id}`}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {accepting === t.trip_id ? (
                    <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={16} /> Godta tur
                    </>
                  )}
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Today snapshot */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat label="Inntekt i dag" value={`${summary.income} kr`} testid="stat-income" />
        <Stat label="Turer" value={summary.trips} testid="stat-trips" />
        <Stat label="Tilfredshet" value={`${summary.satisfaction}%`} testid="stat-satisfaction" />
      </div>

      {/* History link */}
      <button
        onClick={() => navigate("/driver/history")}
        data-testid="driver-history-link"
        className="btn-ghost w-full mt-3 flex items-center justify-center gap-2 text-sm"
      >
        <History size={16} /> Se turhistorikk
      </button>
      <button
        onClick={() => navigate("/driver/payouts")}
        data-testid="driver-payouts-link"
        className="btn-ghost w-full mt-2 flex items-center justify-center gap-2 text-sm"
      >
        Utbetalinger
      </button>
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

function Stat({ label, value, testid }) {
  return (
    <div className="card p-3" data-testid={testid}>
      <div className="text-[10px] text-[#7a827a] uppercase tracking-widest">{label}</div>
      <div className="font-display text-lg text-white mt-1">{value}</div>
    </div>
  );
}
