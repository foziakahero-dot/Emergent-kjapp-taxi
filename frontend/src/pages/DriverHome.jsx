import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi, placesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import PremiumMap from "../components/PremiumMap";
import { Navigation, Check, Phone, Star, ChevronRight, MapPinOff, RefreshCw, Flame, BellRing } from "lucide-react";
import { playNewTripPing, primeAudioOnUserGesture } from "../lib/sound";
import { subscribePush, ensureServiceWorker } from "../lib/push";
import { toast } from "sonner";

const GPS_MIN_INTERVAL_MS = 15000; // don't write more often than this …
const GPS_MIN_MOVE_M = 25;         // … unless the driver actually moved

function notifyNewTrip(count) {
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

export default function DriverHome() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [current, setCurrent] = useState(null);
  const [summary, setSummary] = useState(null);      // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [online, setOnline] = useState(null);        // null until backend answers
  const [accepting, setAccepting] = useState(null);
  const [pos, setPos] = useState(null);              // {lat, lng, heading}
  const [gpsState, setGpsState] = useState("locating"); // locating | ok | denied
  const [place, setPlace] = useState(null);          // reverse-geocoded label
  const [heatOn, setHeatOn] = useState(false);
  const [demand, setDemand] = useState(null);        // null = not loaded yet
  const [pushPerm, setPushPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const watchRef = useRef(null);
  const lastSentRef = useRef({ at: 0, lat: null, lng: null });
  const lastGeoRef = useRef({ at: 0, lat: null, lng: null });
  const prevPendingRef = useRef({ ids: new Set(), initialized: false });
  const onlineRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => { primeAudioOnUserGesture(); ensureServiceWorker(); }, []);
  // Already allowed notifications? Make sure the push subscription exists server-side,
  // otherwise the driver would never receive lock-screen ride requests.
  useEffect(() => { if (pushPerm === "granted") subscribePush(); }, [pushPerm]);
  useEffect(() => { onlineRef.current = online === true; }, [online]);

  const load = useCallback(async (isFirst = false) => {
    try {
      const [p, c, s] = await Promise.all([driverApi.pending(), driverApi.current(), driverApi.summary()]);
      const trips = p.trips || [];
      const ids = new Set(trips.map((t) => t.trip_id));
      const prev = prevPendingRef.current;
      const fresh = [...ids].filter((id) => !prev.ids.has(id));
      if (prev.initialized && fresh.length > 0 && onlineRef.current) {
        try {
          playNewTripPing();
          setTimeout(() => { try { playNewTripPing(); } catch { /* blocked */ } }, 700);
          setTimeout(() => { try { playNewTripPing(); } catch { /* blocked */ } }, 1400);
        } catch { /* blocked */ }
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch { /* unsupported */ }
        notifyNewTrip(fresh.length);
      }
      prevPendingRef.current = { ids, initialized: true };
      setPending(trips);
      setCurrent(c);
      setSummary(s);
      setLoadFailed(false);
      if (isFirst || online === null) setOnline(!!s.online);
    } catch {
      setLoadFailed(true);
      if (isFirst) setSummary(undefined); // undefined = failed, not "zero"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live GPS: the map always reflects the driver's real device position. Location is only
  // written to the backend while the driver is Online (privacy + no needless DB writes).
  const startWatch = useCallback(async () => {
    if (watchRef.current) return;
    setGpsState("locating");
    const { watchLocation } = await import("../lib/native");
    watchRef.current = await watchLocation(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setPos({ lat, lng, heading: p.coords.heading || 0 });
        setGpsState("ok");
        if (!onlineRef.current) return;
        const now = Date.now();
        const last = lastSentRef.current;
        const moved = last.lat == null ? Infinity : distanceMeters(last.lat, last.lng, lat, lng);
        if (now - last.at < GPS_MIN_INTERVAL_MS && moved < GPS_MIN_MOVE_M) return;
        lastSentRef.current = { at: now, lat, lng };
        driverApi.location(lat, lng, p.coords.heading, p.coords.speed).catch(() => {});
      },
      () => { setGpsState("denied"); },
    );
  }, []);

  useEffect(() => {
    startWatch();
    return () => { watchRef.current?.clear?.(); watchRef.current = null; };
  }, [startWatch]);

  // Real demand ("travle soner") — only fetched while the driver asks for it
  useEffect(() => {
    if (!heatOn) return;
    let alive = true;
    const fetchDemand = () => {
      driverApi
        .demand(pos?.lat, pos?.lng)
        .then((d) => { if (alive) setDemand(d); })
        .catch(() => { if (alive) setDemand(undefined); });
    };
    fetchDemand();
    const t = setInterval(fetchDemand, 120000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatOn]);

  const enablePush = async () => {
    setPushBusy(true);
    const res = await subscribePush();
    setPushPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    if (!res.ok && res.reason === "unsupported") setPushPerm("unsupported");
    setPushBusy(false);
  };

  const retryGps = async () => {
    watchRef.current?.clear?.();
    watchRef.current = null;
    await startWatch();
  };

  // Real street/area name for the map label — throttled, never invented
  useEffect(() => {
    if (!pos) return;
    const last = lastGeoRef.current;
    const moved = last.lat == null ? Infinity : distanceMeters(last.lat, last.lng, pos.lat, pos.lng);
    if (Date.now() - last.at < 30000 && moved < 150) return;
    lastGeoRef.current = { at: Date.now(), lat: pos.lat, lng: pos.lng };
    const coords = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
    placesApi
      .reverse(pos.lat, pos.lng)
      .then((r) => setPlace(r?.label || coords))   // no name from the map provider -> show the real coordinates
      .catch(() => setPlace(coords));
  }, [pos]);

  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    onlineRef.current = next;
    try {
      await driverApi.online(next);
      if (next) lastSentRef.current = { at: 0, lat: null, lng: null };
      if (next && pos) driverApi.location(pos.lat, pos.lng, pos.heading, null).catch(() => {});
      await load(false);
    } catch {
      setOnline(!next);          // backend refused — never fake the availability state
      onlineRef.current = !next;
    }
  };

  const accept = async (trip_id) => {
    setAccepting(trip_id);
    try {
      await driverApi.accept(trip_id);
      await load(false);
      navigate("/driver/trip");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Kunne ikke godta turen — prøv igjen");
      await load(false);
    } finally {
      setAccepting(null);
    }
  };

  const declineTrip = async (trip_id) => {
    setPending((prev) => prev.filter((t) => t.trip_id !== trip_id));
    try { await driverApi.decline(trip_id); } catch { toast.error("Kunne ikke registrere avslaget"); }
  };

  const request = pending[0] || null;
  const mapRoute = useMemo(() => {
    const geo = current?.pickup_route?.geometry || request?.pickup_route?.geometry;
    return geo?.coordinates?.length ? geo.coordinates : null;
  }, [current, request]);
  const mapPickup = current
    ? (current.status === "in_trip" ? null : { lat: current.pickup_lat, lng: current.pickup_lng })
    : request ? { lat: request.pickup_lat, lng: request.pickup_lng } : null;

  const firstName = (user?.fullName || "Sjåfør").split(" ")[0];
  const loading = summary === null;
  const failed = summary === undefined;

  return (
    <div className="pb-24 page-enter" data-testid="driver-home">
      {/* ── LIVE MAP with integrated status ────────────────────────── */}
      <div className="relative" style={{ height: "38vh", minHeight: 250 }} data-testid="driver-map-shell">
        {gpsState === "denied" ? (
          <GpsUnavailable onRetry={retryGps} />
        ) : pos ? (
          <PremiumMap
            center={[pos.lng, pos.lat]}
            zoom={heatOn ? 12.2 : mapRoute ? 13.6 : 15.2}
            pitch={45}
            activeCar={{ lat: pos.lat, lng: pos.lng, bearing: pos.heading || 0 }}
            followActive={!mapRoute}
            pickup={mapPickup}
            dropoff={current?.status === "in_trip" ? { lat: current.dropoff_lat, lng: current.dropoff_lng } : null}
            route={mapRoute}
            heat={heatOn && demand?.cells?.length ? demand.cells : null}
            paddingBottom={40}
            testid="driver-map"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center" style={{ background: "#06090A" }} data-testid="driver-map-locating">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full border-2 animate-spin" style={{ borderColor: "rgba(203,163,101,0.22)", borderTopColor: "var(--accent)" }} />
              <div className="text-[12px] mt-3" style={{ color: "var(--text-muted)" }}>Finner posisjonen din…</div>
            </div>
          </div>
        )}

        {/* map overlays */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{ background: "linear-gradient(180deg, rgba(3,6,7,0.85), transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(0deg, var(--bg-base) 12%, rgba(3,6,7,0.7) 55%, transparent)" }} />

        <div className="absolute inset-x-0 top-0 px-4 flex items-start justify-between z-[20]" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}>
          <div
            className="rounded-full px-3.5 py-1.5 flex flex-col leading-none"
            style={{ background: "rgba(6,10,13,0.78)", border: "1px solid rgba(244,244,240,0.10)", backdropFilter: "blur(14px)" }}
            data-testid="driver-map-brand"
          >
            <span className="font-display text-[15px] tracking-[0.02em]" style={{ color: "var(--text)" }}>
              KJ<span style={{ color: "var(--accent)" }}>A</span>PP
            </span>
            <span className="text-[7px] tracking-[0.42em] uppercase mt-0.5" style={{ color: "rgba(203,163,101,0.85)" }}>Driver</span>
          </div>

          <button
            onClick={toggleOnline}
            disabled={online === null}
            data-testid="driver-online-toggle"
            aria-pressed={online === true}
            className="rounded-full pl-3 pr-3.5 py-2 flex items-center gap-2 transition-colors active:scale-[0.97] disabled:opacity-50"
            style={{
              background: online ? "rgba(47,224,140,0.14)" : "rgba(6,10,13,0.78)",
              border: `1px solid ${online ? "rgba(47,224,140,0.45)" : "rgba(244,244,240,0.12)"}`,
              backdropFilter: "blur(14px)",
            }}
          >
            <span className="relative w-2.5 h-2.5 shrink-0">
              {online && (
                <span className="absolute inset-0 rounded-full" style={{ background: "rgba(47,224,140,0.5)", animation: "kjapp-online-pulse 2.4s ease-out infinite" }} />
              )}
              <span className="absolute inset-0 rounded-full" style={{ background: online ? "#2FE08C" : "#8A9198", boxShadow: online ? "0 0 10px rgba(47,224,140,0.8)" : "none" }} />
            </span>
            <span className="text-[10.5px] uppercase tracking-[0.22em]" style={{ color: online ? "#2FE08C" : "var(--text-muted)" }} data-testid="driver-status-title">
              {online === null ? "…" : online ? "Online" : "Offline"}
            </span>
          </button>
        </div>

        {gpsState !== "denied" && (
          <button
            onClick={() => setHeatOn((v) => !v)}
            data-testid="driver-heat-toggle"
            aria-pressed={heatOn}
            className="absolute right-4 z-[20] rounded-full pl-2.5 pr-3 py-1.5 flex items-center gap-1.5 active:scale-[0.97] transition-colors"
            style={{
              bottom: 52,
              background: heatOn ? "rgba(203,163,101,0.18)" : "rgba(6,10,13,0.78)",
              border: `1px solid ${heatOn ? "rgba(203,163,101,0.5)" : "rgba(244,244,240,0.12)"}`,
              backdropFilter: "blur(14px)",
            }}
          >
            <Flame size={13} style={{ color: heatOn ? "var(--accent)" : "var(--text-muted)" }} />
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: heatOn ? "var(--accent)" : "var(--text-muted)" }}>
              Travle soner
            </span>
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 px-4 pb-2 z-[20] flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "rgba(203,163,101,0.9)" }}>Din posisjon</div>
            <div className="text-[13.5px] truncate" style={{ color: "var(--text)" }} data-testid="driver-place">
              {gpsState === "denied" ? "Posisjon ikke tilgjengelig" : place || (pos ? "Henter gatenavn…" : "Finner posisjon…")}
            </div>
          </div>
          <div className="text-[10.5px] text-right shrink-0" style={{ color: online ? "#2FE08C" : "var(--text-muted)" }} data-testid="driver-status-sub">
            {online ? "Du mottar turforespørsler" : "Du mottar ikke turforespørsler"}
          </div>
        </div>
        <style>{`@keyframes kjapp-online-pulse { 0% { transform: scale(0.8); opacity: 0.9; } 100% { transform: scale(2.4); opacity: 0; } }`}</style>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────── */}
      <div className="px-4 -mt-2">
        {/* Greeting + today's real numbers */}
        <div className="flex items-end justify-between gap-3" data-testid="driver-overview">
          <div className="min-w-0">
            <div className="font-display text-[22px] leading-tight" style={{ color: "var(--text)" }} data-testid="driver-greeting">
              {greetingFor(new Date())}, {firstName}
            </div>
            {loading ? (
              <Skeleton className="mt-2" width={170} height={13} />
            ) : (
              <div className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }} data-testid="driver-trip-count">
                {failed ? "Kunne ikke hente dagens tall" : summaryLine(summary)}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>I dag</div>
            {loading ? (
              <Skeleton className="mt-1.5 ml-auto" width={62} height={20} />
            ) : (
              <div className="font-display text-[22px] leading-none mt-1" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }} data-testid="driver-income-today">
                {failed ? "—" : `${summary.income} kr`}
              </div>
            )}
          </div>
        </div>

        {loadFailed && !loading && (
          <button onClick={() => load(true)} data-testid="driver-retry" className="mt-3 w-full rounded-2xl px-4 py-3 flex items-center justify-center gap-2 text-[12.5px]" style={{ background: "rgba(215,106,90,0.10)", border: "1px solid rgba(215,106,90,0.28)", color: "#e08a7a" }}>
            <RefreshCw size={14} /> Kunne ikke oppdatere — trykk for å prøve igjen
          </button>
        )}

        {/* Real demand zones — only what the database actually shows */}
        <AnimatePresence>
          {heatOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
              data-testid="driver-demand-panel"
            >
              <div className="mt-4 card p-4" style={{ border: "1px solid rgba(203,163,101,0.26)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>Travle soner nå</div>
                  {demand?.zones?.length > 0 && (
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }} data-testid="driver-demand-basis">
                      {demand.total_recent} turer siste 90 min
                    </div>
                  )}
                </div>

                {demand === null ? (
                  <Skeleton width="100%" height={54} />
                ) : demand === undefined ? (
                  <div className="text-[12.5px]" style={{ color: "#e08a7a" }} data-testid="driver-demand-error">
                    Kunne ikke hente etterspørsel akkurat nå.
                  </div>
                ) : demand.zones.length === 0 ? (
                  <div className="text-center py-4" data-testid="driver-demand-empty">
                    <div className="font-display text-[15px]" style={{ color: "var(--text)" }}>Ingen etterspørselsdata ennå</div>
                    <div className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Varmekartet bygges på faktiske turer. Så snart det bestilles turer i området, dukker sonene opp her.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5" data-testid="driver-demand-zones">
                    {demand.zones.map((z, i) => (
                      <div key={`${z.lat},${z.lng}`} className="flex items-center gap-3" data-testid={`driver-zone-${i}`}>
                        <div
                          className="w-8 h-8 rounded-xl grid place-items-center shrink-0 font-display text-[13px]"
                          style={{ background: `rgba(203,163,101,${0.1 + z.weight * 0.22})`, border: "1px solid rgba(203,163,101,0.3)", color: "var(--accent)" }}
                        >
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] truncate" style={{ color: "var(--text)" }}>
                            {z.label || `${z.lat.toFixed(3)}, ${z.lng.toFixed(3)}`}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {[
                              z.recent > 0 ? `${z.recent} turer siste 90 min` : `${z.typical} turer denne timen normalt`,
                              z.distance_km != null ? `${fmtDistance(z.distance_km)} unna` : null,
                              z.drivers > 0 ? `${z.drivers} bil${z.drivers > 1 ? "er" : ""} her nå` : null,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        {z.avg_earnings != null && (
                          <div className="text-right shrink-0">
                            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Snitt</div>
                            <div className="font-display text-[15px]" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                              {z.avg_earnings} kr
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lock-screen alerts for new ride requests */}
        {pushPerm === "default" && (
          <button
            onClick={enablePush}
            disabled={pushBusy}
            data-testid="driver-push-enable"
            className="mt-4 w-full card p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform disabled:opacity-60"
            style={{ border: "1px solid rgba(47,224,140,0.28)" }}
          >
            <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(47,224,140,0.12)" }}>
              <BellRing size={16} style={{ color: "#2FE08C" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px]" style={{ color: "var(--text)" }}>Få turer på låst skjerm</div>
              <div className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                {pushBusy ? "Aktiverer…" : "Slå på varsler, så mister du ingen turforespørsler når appen er lukket."}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
        {pushPerm === "denied" && (
          <div className="mt-4 text-[11.5px] px-1" style={{ color: "var(--text-muted)" }} data-testid="driver-push-denied">
            Varsler er blokkert i telefoninnstillingene — skru dem på for KJAPP for å få turer på låst skjerm.
          </div>
        )}

        {/* Active trip */}
        {current && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="driver-active-card"
            className="mt-4 card p-4"
            style={{ border: "1px solid rgba(203,163,101,0.34)", boxShadow: "0 12px 32px rgba(203,163,101,0.10)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                <span className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "var(--accent)" }} data-testid="active-badge">Aktiv tur</span>
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
                  {current.status === "in_trip" ? current.dropoff_address : current.pickup_address}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {[current.customer?.name, current.pickup_route ? `${fmtDistance(current.pickup_route.distance_km)} til henting` : (current.distance_km != null ? `${current.distance_km} km tur` : null)]
                    .filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-[17px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {current.driver_earnings != null ? `${current.driver_earnings} kr` : "—"}
                </div>
              </div>
            </div>
            <button onClick={() => navigate("/driver/trip")} data-testid="active-open" className="mt-3 btn-primary w-full flex items-center justify-center gap-2">
              Åpne aktiv tur <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Incoming real ride requests */}
        <div className="mt-6" data-testid="pending-list">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
              {current ? "Kommende turer" : "Neste tur"}
            </h2>
            {pending.length > 0 && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }} data-testid="pending-count">
                {pending.length} venter
              </span>
            )}
          </div>

          {loading ? (
            <div className="card p-4" data-testid="pending-skeleton">
              <Skeleton width="55%" height={14} />
              <Skeleton className="mt-3" width="80%" height={12} />
              <Skeleton className="mt-2" width="70%" height={12} />
              <Skeleton className="mt-4" width="100%" height={40} />
            </div>
          ) : (
            <AnimatePresence>
              {pending.length === 0 ? (
                <motion.div
                  key="no-pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card p-8 text-center"
                  data-testid="driver-no-active"
                >
                  <div className="font-display text-[16px]" style={{ color: "var(--text)" }}>
                    {current ? "Ingen kommende turer" : "Ingen aktiv tur"}
                  </div>
                  <div className="text-[12.5px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                    {online ? "Du er online og klar for nye turforespørsler." : "Du mottar ikke turforespørsler når du er offline."}
                  </div>
                  {online === false && (
                    <button onClick={toggleOnline} data-testid="driver-no-active-go-online" className="btn-primary mt-4">
                      Gå online
                    </button>
                  )}
                </motion.div>
              ) : (
                pending.map((t, i) => (
                  <TripRequestCard
                    key={t.trip_id}
                    primary={i === 0}
                    trip={t}
                    accepting={accepting === t.trip_id}
                    onAccept={() => accept(t.trip_id)}
                    onDecline={() => declineTrip(t.trip_id)}
                  />
                ))
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Real earnings summary */}
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
            <Metric label="I dag" value={loading || failed ? "—" : `${summary.income} kr`} testid="metric-income" />
            <Metric label="Turer" value={loading || failed ? "—" : summary.trips} testid="metric-trips" />
            <Metric label="Online" value={loading || failed ? "—" : formatOnlineTime(summary.online_minutes)} testid="metric-online-time" />
            <Metric
              label="Godta-rate"
              value={loading || failed || summary.acceptance_rate == null ? "—" : `${summary.acceptance_rate}%`}
              testid="metric-acceptance"
            />
          </div>
        </button>
      </div>
    </div>
  );
}

/** GPS denied/unavailable — never fall back to a fictional city position */
function GpsUnavailable({ onRetry }) {
  return (
    <div className="absolute inset-0 grid place-items-center px-8 text-center" style={{ background: "radial-gradient(120% 80% at 50% 0%, #0D1419, #05080A)" }} data-testid="driver-gps-unavailable">
      <div>
        <div className="w-12 h-12 mx-auto rounded-full grid place-items-center" style={{ background: "rgba(244,244,240,0.05)", border: "1px solid rgba(244,244,240,0.10)" }}>
          <MapPinOff size={20} style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="font-display text-[17px] mt-3" style={{ color: "var(--text)" }}>Posisjon ikke tilgjengelig</div>
        <div className="text-[12.5px] mt-1" style={{ color: "var(--text-muted)" }}>
          Aktiver posisjonstilgang for å bruke KJAPP.
        </div>
        <button onClick={onRetry} data-testid="driver-gps-retry" className="btn-ghost mt-4 inline-flex items-center gap-2 text-[12.5px]">
          <RefreshCw size={14} /> Prøv igjen
        </button>
      </div>
    </div>
  );
}

/** Real ride request — every number comes from the backend (routing/pricing), never invented */
function TripRequestCard({ trip, accepting, onAccept, onDecline, primary }) {
  // Freshness bar only — a real request is NEVER auto-declined on the driver's behalf.
  const [age, setAge] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAge((a) => a + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, 30 - age);
  const pct = (remaining / 30) * 100;
  const pickupRoute = trip.pickup_route;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="card p-4 mb-3"
      data-testid={primary ? "driver-request-card" : `pending-${trip.trip_id}`}
    >
      <div className="h-[3px] rounded-full mb-3" style={{ background: "rgba(244,244,240,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            background: remaining <= 5 ? "linear-gradient(90deg, #d76a5a, #e0956a)" : "linear-gradient(90deg, var(--accent), #DDB77A)",
          }}
        />
      </div>

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
            <div className="text-[15px] font-medium truncate" style={{ color: "var(--text)" }}>{trip.customer.name}</div>
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {trip.customer.rating != null ? (
                <>
                  <Star size={11} fill="currentColor" style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--accent)" }}>{trip.customer.rating.toFixed(1)}</span>
                </>
              ) : (
                <span>Ny kunde</span>
              )}
              {trip.customer.trip_count > 0 && <span>· {trip.customer.trip_count} turer</span>}
            </div>
          </div>
          {trip.customer.phone && (
            <a
              href={`tel:${trip.customer.phone}`}
              onClick={(e) => e.stopPropagation()}
              data-testid={`pending-call-${trip.trip_id}`}
              className="w-10 h-10 rounded-full grid place-items-center shrink-0"
              style={{ background: "var(--accent-soft)", border: "1px solid rgba(203,163,101,0.25)", color: "var(--accent)" }}
              aria-label={`Ring ${trip.customer.name}`}
            >
              <Phone size={16} />
            </a>
          )}
        </div>
      )}

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

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl p-2.5" style={{ background: "rgba(244,244,240,0.03)" }}>
          <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Til henting</div>
          <div className="text-[13px] mt-0.5" style={{ color: "var(--text)" }} data-testid={`pickup-dist-${trip.trip_id}`}>
            {pickupRoute ? `${fmtDistance(pickupRoute.distance_km)} · ${pickupRoute.duration_min} min` : "Krever GPS"}
          </div>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: "rgba(244,244,240,0.03)" }}>
          <div className="text-[9px] uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>Selve turen</div>
          <div className="text-[13px] mt-0.5" style={{ color: "var(--text)" }}>
            {trip.distance_km != null ? `${trip.distance_km} km` : "—"}
            {trip.duration_min != null && <><span className="opacity-50"> · </span>{trip.duration_min} min</>}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Din inntjening</div>
        <div className="font-display text-[26px] leading-none" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }} data-testid={`earn-${trip.trip_id}`}>
          {trip.driver_earnings != null ? `${trip.driver_earnings} kr` : "—"}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onDecline}
          disabled={accepting}
          data-testid={primary ? "driver-decline-btn" : `decline-${trip.trip_id}`}
          className="w-[38%] rounded-full py-3 text-[13px] transition-colors disabled:opacity-50"
          style={{ background: "rgba(244,244,240,0.04)", border: "1px solid var(--line)", color: "var(--text-muted)" }}
        >
          Avslå
        </button>
        <button
          onClick={onAccept}
          disabled={accepting}
          data-testid={primary ? "driver-accept-btn" : `accept-${trip.trip_id}`}
          className="flex-1 btn-primary flex flex-col items-center justify-center py-2 disabled:opacity-50"
        >
          {accepting ? (
            <span className="w-4 h-4 border-2 border-[#0B1013] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-medium"><Check size={16} /> Godta tur</span>
              <span className="text-[10px] uppercase tracking-widest opacity-80 mt-0.5">{remaining > 0 ? `Ny forespørsel · ${remaining} sek` : "Venter fortsatt på svar"}</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/** Helpers */
function Skeleton({ width = "100%", height = 12, className = "" }) {
  return (
    <div
      className={`rounded-full ${className}`}
      style={{ width, height, background: "linear-gradient(90deg, rgba(244,244,240,0.05), rgba(244,244,240,0.11), rgba(244,244,240,0.05))", backgroundSize: "200% 100%", animation: "kjapp-shimmer 1.4s ease-in-out infinite" }}
      data-testid="skeleton"
    >
      <style>{`@keyframes kjapp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

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
  const trips = summary?.trips ?? 0;
  if (trips === 0) return "Ingen turer i dag ennå";
  if (trips === 1) return "1 tur fullført i dag";
  return `${trips} turer fullført i dag`;
}

function activeStateLabel(status) {
  if (status === "driver_on_way") return "Kjører til henting";
  if (status === "at_pickup") return "Ankommet hentested";
  if (status === "in_trip") return "Kunde om bord";
  if (status === "arrived") return "Tur fullført";
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

function fmtDistance(km) {
  if (km == null) return "—";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
