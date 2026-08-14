import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi, tripsApi } from "../lib/api";
import { Orb, VoiceBars } from "../components/UIKit";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Clock, Check, Power } from "lucide-react";
import { playNewTripPing, primeAudioOnUserGesture } from "../lib/sound";

export default function DriverHome() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [current, setCurrent] = useState(null);
  const [summary, setSummary] = useState({ income: 0, trips: 0, satisfaction: 98 });
  const [accepting, setAccepting] = useState(null);
  const [online, setOnline] = useState(() => localStorage.getItem("kjapp_driver_online") === "true");
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);
  const prevPendingIdsRef = useRef(new Set());
  const navigate = useNavigate();

  // Prime audio unlock on first user gesture (mobile browsers block autoplay)
  useEffect(() => { primeAudioOnUserGesture(); }, []);

  const load = async () => {
    try {
      const [p, c, s] = await Promise.all([driverApi.pending(), driverApi.current(), driverApi.summary()]);
      const trips = p.trips || [];
      // Play ping when a new trip appears (only if online)
      const currentIds = new Set(trips.map((t) => t.trip_id));
      const prev = prevPendingIdsRef.current;
      const newOnes = [...currentIds].filter((id) => !prev.has(id));
      if (newOnes.length > 0 && prev.size >= 0 && online) {
        // Skip the first load (prev.size === 0 means we don't know previous state yet)
        if (prevPendingIdsRef.current.__initialized) {
          try { playNewTripPing(); } catch { /* audio play blocked */ }
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
    if (online) {
      if (!navigator.geolocation) { setGpsError("Nettleseren støtter ikke GPS"); return; }
      const opts = { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 };
      let lastSent = 0;
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError(null);
          const now = Date.now();
          if (now - lastSent < 4500) return;  // throttle to every ~5s
          lastSent = now;
          driverApi.location(pos.coords.latitude, pos.coords.longitude, pos.coords.heading, pos.coords.speed).catch(() => {});
        },
        (err) => { setGpsError("GPS-feil: " + err.message); },
        opts,
      );
    } else {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    }
    return () => {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
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
        <div className={`w-11 h-11 rounded-full grid place-items-center ${online ? "bg-mint/15" : "bg-[#17223a]"}`}>
          <Power size={18} className={online ? "text-mint" : "text-[#8a94a8]"} />
        </div>
        <div className="flex-1">
          <div className="text-white text-sm font-medium">{online ? "På vakt" : "Offline"}</div>
          <div className="text-[11px] text-[#8a94a8]">{online ? (gpsError || "Du mottar turer") : "Slå på for å motta turer"}</div>
        </div>
        <button
          onClick={() => setOnline((v) => !v)}
          data-testid="driver-online-toggle"
          className={`relative w-14 h-8 rounded-full transition-colors ${online ? "bg-mint" : "bg-[#2a3550]"}`}
          aria-pressed={online}
        >
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${online ? "translate-x-6" : ""}`} />
        </button>
      </div>

      {/* Hero */}
      <div className="mt-3 card p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-40 pointer-events-none">
          <div className="orb" style={{ width: 130, height: 130 }} />
        </div>
        <div className="relative">
          <div className="text-[11px] text-mint uppercase tracking-widest">Oversikt</div>
          <h1 className="mt-2 font-display text-[22px] tracking-tight text-white leading-tight">
            Hei {firstName}.<br />
            {pending.length > 0 || current
              ? `${pending.length + (current ? 1 : 0)} tur${pending.length + (current ? 1 : 0) === 1 ? "" : "er"} nå.`
              : online ? "Ingen turer akkurat nå." : "Slå på for å begynne."}
          </h1>
          <p className="text-[#8a94a8] text-sm mt-1">
            {current ? "Du har en aktiv tur." : pending.length ? "Klar til å kjøre?" : online ? "Vi varsler deg når det kommer en tur." : "Du er offline."}
          </p>
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
        <span className="text-[11px] text-[#8a94a8]">{pending.length} venter</span>
      </div>

      <div className="mt-2 space-y-2">
        <AnimatePresence>
          {pending.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 text-center">
              <Orb size="small" />
              <div className="text-[#8a94a8] text-sm mt-3">Ingen turer venter</div>
              <div className="text-[11px] text-[#6d7690] mt-1">Turer dukker opp automatisk her</div>
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
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-2 h-2 rounded-full bg-mint" />
                    <div className="w-px h-6 bg-[#2a3550]" />
                    <div className="w-2 h-2 rounded-sm bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#8a94a8]">Henting</div>
                    <div className="text-white text-sm truncate">{t.pickup_address}</div>
                    <div className="text-[11px] text-[#8a94a8] mt-1">Til</div>
                    <div className="text-white text-sm truncate">{t.dropoff_address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[#b8bfd0] mb-3 border-t border-line pt-2">
                  <span>{t.distance_km} km</span>
                  <span>·</span>
                  <span>{t.duration_min} min</span>
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
    </div>
  );
}

function Stat({ label, value, testid }) {
  return (
    <div className="card p-3" data-testid={testid}>
      <div className="text-[10px] text-[#8a94a8] uppercase tracking-widest">{label}</div>
      <div className="font-display text-lg text-white mt-1">{value}</div>
    </div>
  );
}
