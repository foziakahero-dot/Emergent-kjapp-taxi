import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi } from "../lib/api";
import { toast } from "sonner";
import PremiumMap from "../components/PremiumMap";
import { openMapsNavigation } from "../lib/mapAssets";
import { computeDriverPosition } from "../lib/tripAnimation";
import ChatModal from "../components/ChatModal";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Phone, MessageCircle, ChevronLeft, Play, Flag, MapPin, ShieldAlert, X, AlertTriangle, Share2, HelpCircle } from "lucide-react";
import { Orb } from "../components/UIKit";
import { messagesApi } from "../lib/api";


export default function DriverTrip() {
  const [trip, setTrip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [autoNav, setAutoNav] = useState(() => localStorage.getItem("kjapp_auto_nav") === "true");
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [carPos, setCarPos] = useState(null);
  const lastStatusRef = useRef(null);
  const watchIdRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const t = await driverApi.current();
      setTrip(t);
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, []);

  // Push real GPS while trip is active
  useEffect(() => {
    if (!trip || !["driver_on_way", "at_pickup", "in_trip"].includes(trip.status)) {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      return;
    }
    if (!navigator.geolocation) return;
    let lastSent = 0;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 4500) return;
        lastSent = now;
        driverApi.location(pos.coords.latitude, pos.coords.longitude, pos.coords.heading, pos.coords.speed).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    return () => {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    };
  }, [trip?.status]);

  // Animate driver car (prefer real GPS from trip, fallback to interpolation)
  useEffect(() => {
    if (!trip) { setCarPos(null); return; }
    if (trip.status !== "driver_on_way" && trip.status !== "in_trip") { setCarPos(null); return; }
    const tick = () => setCarPos(computeDriverPosition(trip));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [trip]);

  // Auto-open Google Maps when a new trip becomes active (transition into driver_on_way or in_trip)
  useEffect(() => {
    if (!trip || !autoNav) return;
    const prev = lastStatusRef.current;
    lastStatusRef.current = trip.status;
    if (prev !== trip.status && (trip.status === "driver_on_way" || trip.status === "in_trip")) {
      const [lat, lng] = trip.status === "in_trip"
        ? [trip.dropoff_lat, trip.dropoff_lng]
        : [trip.pickup_lat, trip.pickup_lng];
      // small delay so UI can settle
      setTimeout(() => openMapsNavigation(lat, lng), 500);
    }
  }, [trip?.status, autoNav]);

  const openNav = () => {
    if (!trip) return;
    const [lat, lng] = trip.status === "in_trip"
      ? [trip.dropoff_lat, trip.dropoff_lng]
      : [trip.pickup_lat, trip.pickup_lng];
    openMapsNavigation(lat, lng);
  };

  const toggleAutoNav = () => {
    const v = !autoNav;
    setAutoNav(v);
    localStorage.setItem("kjapp_auto_nav", String(v));
  };

  const start = async () => {
    setBusy(true);
    try { await driverApi.start(trip.trip_id); await load(); } catch (e) { alert("Kunne ikke starte"); } finally { setBusy(false); }
  };

  const atPickup = async () => {
    setBusy(true);
    try { await driverApi.atPickup(trip.trip_id); await load(); } catch (e) { alert("Kunne ikke registrere ankomst"); } finally { setBusy(false); }
  };

  const noShow = async () => {
    if (!window.confirm("Bekreft: Kunden dukket ikke opp?\n\nDette avlyser turen og logger no-show. Bruk kun hvis du har ventet i minst 5 min.")) return;
    setBusy(true);
    try { await driverApi.noShow(trip.trip_id); setTimeout(() => navigate("/driver"), 1200); } catch (e) { alert("Kunne ikke avlyse"); } finally { setBusy(false); }
  };
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Poll unread messages every 3s while trip active
  useEffect(() => {
    if (!trip || (trip.status !== "driver_on_way" && trip.status !== "in_trip")) return;
    const load = () => messagesApi.unreadCount().then((r) => setUnread(r.unread || 0)).catch(() => {});
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, [trip?.status]);

  // When chat opens, mark as seen
  useEffect(() => {
    if (chatOpen && trip?.trip_id) {
      messagesApi.markSeen(trip.trip_id).then(() => setUnread(0)).catch(() => {});
    }
  }, [chatOpen, trip?.trip_id]);

  const arrive = async () => {
    setBusy(true);
    try {
      const res = await driverApi.arrive(trip.trip_id);
      (res?.bonuses || []).forEach((b) => toast.success(`Bonus opptjent · +${b.amount} kr`, { description: `${b.name} — ${b.trips} turer fullført` }));
      await load();
      setTimeout(() => navigate("/driver"), res?.bonuses?.length ? 3200 : 1500);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Kunne ikke fullføre turen");
    } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!window.confirm("Er du sikker på at du vil avbryte turen?\n\nBruk dette KUN hvis kunden ikke dukker opp eller det oppstår et problem.")) return;
    setBusy(true);
    try {
      await driverApi.cancel(trip.trip_id);
      await load();
      setTimeout(() => navigate("/driver"), 1000);
    } catch (e) { alert("Kunne ikke avbryte"); } finally { setBusy(false); }
  };

  if (!trip) {
    return (
      <div className="px-4 pt-2 pb-24 page-enter">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate("/driver")} className="w-10 h-10 grid place-items-center text-[#7a827a]" data-testid="dtrip-back">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-white text-lg font-medium">Navigasjon</h1>
        </div>
        <div className="card p-8 text-center">
          <Orb size="small" />
          <div className="text-white text-sm mt-4">Ingen aktiv tur</div>
          <div className="text-[#7a827a] text-xs mt-1">Godta en tur fra hjem-skjermen</div>
        </div>
      </div>
    );
  }

  // Real route for the leg the driver is on: driver -> pickup, then pickup -> destination
  const onPickupLeg = trip.status === "driver_on_way" || trip.status === "at_pickup";
  let routePoints = null;
  if (onPickupLeg && trip.pickup_route?.geometry?.coordinates?.length) {
    routePoints = trip.pickup_route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else if (trip.geometry?.coordinates?.length) {
    routePoints = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else {
    routePoints = [[trip.pickup_lat, trip.pickup_lng], [trip.dropoff_lat, trip.dropoff_lng]];
  }

  const statusLabel = {
    driver_on_way: "Kjører til henting",
    at_pickup: "Ankommet hentested",
    in_trip: "Kunde om bord",
    arrived: "Tur fullført",
  }[trip.status] || trip.status;

  return (
    <div className="relative" style={{ height: "calc(100dvh - 80px)" }}>
      <div className="absolute inset-0">
        <PremiumMap
          center={[(trip.pickup_lng + trip.dropoff_lng) / 2, (trip.pickup_lat + trip.dropoff_lat) / 2]}
          zoom={13}
          pitch={45}
          route={routePoints.map(([lat, lng]) => [lng, lat])}
          pickup={{ lat: trip.pickup_lat, lng: trip.pickup_lng }}
          dropoff={{ lat: trip.dropoff_lat, lng: trip.dropoff_lng }}
          activeCar={carPos ? { lat: carPos.lat, lng: carPos.lng, bearing: carPos.bearing } : null}
          followActive={trip.status === "in_trip" || trip.status === "driver_on_way"}
          testid="driver-trip-map"
        />
      </div>

      {/* Top */}
      <div className="relative z-[1000] px-4 pt-2 flex items-center justify-between">
        <button onClick={() => navigate("/driver")} className="w-10 h-10 grid place-items-center rounded-full bg-[#131a1f]/85 border border-line backdrop-blur-md" data-testid="dtrip-back-map">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="text-sm text-white bg-[#131a1f]/85 border border-line backdrop-blur-md rounded-full px-4 py-2" data-testid="dtrip-status-label">
          {statusLabel}
        </div>
        {/* 10. SAFETY — unobtrusive shield button, only during active states */}
        {(trip.status === "driver_on_way" || trip.status === "at_pickup" || trip.status === "in_trip") ? (
          <button
            onClick={() => setSafetyOpen(true)}
            data-testid="dtrip-safety"
            aria-label="Sikkerhet"
            className="w-10 h-10 grid place-items-center rounded-full bg-[#131a1f]/85 border backdrop-blur-md"
            style={{ borderColor: "rgba(203,163,101,0.35)" }}
          >
            <ShieldAlert size={16} style={{ color: "var(--accent)" }} />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute left-0 right-0 bottom-0 z-[1000] p-4"
      >
        <div className="card p-4">
          {/* Customer strip — vises tydelig så sjåfør vet hvem de henter */}
          {trip.customer && (
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-line" data-testid="dtrip-customer">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mint/25 to-mint/5 grid place-items-center text-mint font-medium text-sm">
                {trip.customer.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{trip.customer.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {trip.customer.rating != null ? `★ ${trip.customer.rating.toFixed(1)}` : "Ny kunde"}
                  {trip.customer.trip_count > 0 && ` · ${trip.customer.trip_count} turer`}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-mint/10 grid place-items-center">
              <Navigation size={18} className="text-mint" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-mint uppercase tracking-widest">
                {onPickupLeg ? "Henting" : "Destinasjon"}
              </div>
              <div className="text-white text-sm truncate">
                {onPickupLeg ? trip.pickup_address : trip.dropoff_address}
              </div>
            </div>
            <div className="text-right">
              {onPickupLeg ? (
                <>
                  <div className="text-white font-semibold">{trip.pickup_route ? `${trip.pickup_route.distance_km} km` : "—"}</div>
                  <div className="text-[11px] text-[#7a827a]">{trip.pickup_route ? `${trip.pickup_route.duration_min} min` : "Krever GPS"}</div>
                </>
              ) : (
                <>
                  <div className="text-white font-semibold">{trip.distance_km != null ? `${trip.distance_km} km` : "—"}</div>
                  <div className="text-[11px] text-[#7a827a]">{trip.duration_min != null ? `${trip.duration_min} min` : "—"}</div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {trip.customer?.phone ? (
              <a
                href={`tel:${trip.customer.phone}`}
                data-testid="dtrip-call"
                className="card p-3 flex flex-col items-center justify-center gap-1 hover:bg-[#17222a] transition-colors border-line"
              >
                <Phone size={16} className="text-mint" />
                <span className="text-[11px] text-white">Ring kunde</span>
              </a>
            ) : (
              <ActionBtn icon={<Phone size={16} />} label="Ring" testid="dtrip-call" onClick={() => alert("Kunde-nummer ikke tilgjengelig.")} />
            )}
            <ActionBtn icon={<MessageCircle size={16} />} label="Melding" testid="dtrip-msg" onClick={() => setChatOpen(true)} badge={unread} />
            <ActionBtn icon={<Flag size={16} />} label="Support" testid="dtrip-support" onClick={() => window.location.href = "mailto:support@kjapp.no?subject=Support%20under%20aktiv%20tur"} />
          </div>

          {/* Prominent open-in-Google-Maps for turn-by-turn */}
          {(trip.status === "driver_on_way" || trip.status === "in_trip") && (
            <>
              <button
                onClick={openNav}
                data-testid="dtrip-open-maps"
                className="w-full mb-2 py-3 rounded-full bg-[#17222a] border border-mint/40 text-white flex items-center justify-center gap-2 hover:border-mint transition-colors"
              >
                <MapPin size={16} className="text-mint" />
                <span className="text-sm font-medium">
                  Naviger i Google Maps
                </span>
              </button>
              <label className="flex items-center gap-2 px-2 mb-3 text-[11px] text-[#a8b0a8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoNav}
                  onChange={toggleAutoNav}
                  data-testid="dtrip-auto-nav"
                  className="accent-mint"
                />
                Åpne Google Maps automatisk ved nye turer
              </label>
            </>
          )}

          {/* 5-state lifecycle CTAs */}
          {trip.status === "driver_on_way" && (
            <>
              <button onClick={atPickup} disabled={busy} data-testid="dt-arrived-pickup" className="btn-primary w-full flex items-center justify-center gap-2">
                <Flag size={16} /> Jeg er fremme
              </button>
              <button onClick={noShow} disabled={busy} data-testid="dtrip-noshow" className="btn-ghost w-full flex items-center justify-center gap-2 text-red-400 border-red-400/20 hover:border-red-400/60 mt-2">
                Kunden dukket ikke opp
              </button>
            </>
          )}
          {trip.status === "at_pickup" && (
            <>
              <button onClick={start} disabled={busy} data-testid="dt-start" className="btn-primary w-full flex items-center justify-center gap-2">
                <Play size={16} /> Kunde om bord
              </button>
              <button onClick={noShow} disabled={busy} data-testid="dtrip-noshow" className="btn-ghost w-full flex items-center justify-center gap-2 text-red-400 border-red-400/20 hover:border-red-400/60 mt-2">
                Kunden dukket ikke opp
              </button>
            </>
          )}
          {trip.status === "in_trip" && (
            <button onClick={arrive} disabled={busy} data-testid="dt-complete" className="btn-primary w-full flex items-center justify-center gap-2">
              <Flag size={16} /> Fullfør tur
            </button>
          )}
          {trip.status === "arrived" && (
            <TripCompletedBreakdown trip={trip} onDone={() => navigate("/driver")} />
          )}
        </div>
      </motion.div>

      {/* Safety menu (10) */}
      <AnimatePresence>
        {safetyOpen && (
          <SafetyMenu
            onClose={() => setSafetyOpen(false)}
            tripId={trip.trip_id}
            passengerName={trip.customer?.name}
          />
        )}
      </AnimatePresence>

      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} tripId={trip.trip_id} role="driver" />
    </div>
  );
}

/** Trip Completed — real breakdown from the platform commission the backend applied */
function TripCompletedBreakdown({ trip, onDone }) {
  const price = trip.price || 0;
  const net = trip.driver_earnings != null ? trip.driver_earnings : null;
  const fee = net != null ? price - net : null;
  return (
    <div className="pt-2" data-testid="dtrip-completed">
      <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-3" style={{ background: "var(--accent-soft)", border: "1px solid rgba(203,163,101,0.35)" }}>
        <Flag size={20} style={{ color: "var(--accent)" }} />
      </div>
      <div className="text-center mb-4">
        <div className="font-display text-[19px]" style={{ color: "var(--text)" }}>Tur fullført</div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Bra jobbet — inntekt registrert</div>
      </div>
      <div className="space-y-2 mb-4">
        <BreakdownRow label="Turpris" value={`${price} kr`} testid="brk-price" />
        <BreakdownRow label="KJAPP avgift" value={fee != null ? `- ${fee} kr` : "—"} testid="brk-fee" muted />
        <div className="h-px" style={{ background: "var(--line)" }} />
        <BreakdownRow label="Til flåten" value={net != null ? `${net} kr` : "—"} testid="brk-net" strong />
      </div>
      <button onClick={onDone} data-testid="dtrip-done" className="btn-primary w-full">
        Ferdig
      </button>
    </div>
  );
}

function BreakdownRow({ label, value, muted, strong, testid }) {
  return (
    <div className="flex items-center justify-between" data-testid={testid}>
      <span className="text-[13px]" style={{ color: muted ? "var(--text-muted)" : "var(--text)" }}>{label}</span>
      <span
        className="font-display leading-none"
        style={{
          color: strong ? "var(--accent)" : muted ? "var(--text-muted)" : "var(--text)",
          fontSize: strong ? 18 : 14,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Safety menu — emergency, report, share trip, support */
function SafetyMenu({ onClose, tripId, passengerName }) {
  const emergency = () => {
    if (window.confirm("Ring nødtelefon (112)?\n\nBruk kun i reelle nødsituasjoner. KJAPP vil dele posisjonen din med nødetatene.")) {
      window.location.href = "tel:112";
    }
  };
  const report = () => {
    window.location.href = `mailto:support@kjapp.no?subject=Rapportering av kunde&body=Turnummer: ${tripId}%0A%0AProblem:%0A`;
    onClose();
  };
  const shareTrip = async () => {
    const url = `${window.location.origin}/app/booking/${tripId}?share=1`;
    if (navigator.share) {
      try { await navigator.share({ title: "KJAPP — Del turen", url }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); alert("Turen ble kopiert til utklippstavlen"); } catch { /* fail */ }
    }
    onClose();
  };
  const support = () => {
    window.location.href = "mailto:support@kjapp.no?subject=Support under aktiv tur";
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-testid="safety-menu"
      className="fixed inset-0 z-[1500] flex items-end"
      style={{ background: "rgba(4,8,10,0.72)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        initial={{ y: 400 }}
        animate={{ y: 0 }}
        exit={{ y: 400 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[24px] p-4 pb-8"
        style={{ background: "rgba(11,16,19,0.98)", borderTop: "1px solid rgba(203,163,101,0.28)" }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(244,244,240,0.14)" }} />
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={18} style={{ color: "var(--accent)" }} />
          <div className="font-display text-[17px] flex-1" style={{ color: "var(--text)" }}>Sikkerhet</div>
          <button onClick={onClose} data-testid="safety-close" className="w-8 h-8 grid place-items-center rounded-full" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          <SafetyBtn
            testid="safety-emergency"
            icon={<AlertTriangle size={16} />}
            label="Ring nødtelefon"
            sub="Direkte til 112 — bare for reelle nødsituasjoner"
            danger
            onClick={emergency}
          />
          <SafetyBtn
            testid="safety-report"
            icon={<Flag size={16} />}
            label="Rapporter kunden"
            sub={passengerName ? `Send rapport om ${passengerName} til KJAPP` : "Send rapport til KJAPP"}
            onClick={report}
          />
          <SafetyBtn
            testid="safety-share"
            icon={<Share2 size={16} />}
            label="Del turen"
            sub="Send live turlenke til noen du stoler på"
            onClick={shareTrip}
          />
          <SafetyBtn
            testid="safety-support"
            icon={<HelpCircle size={16} />}
            label="Kontakt KJAPP support"
            sub="Døgnvakt · svar innen få minutter"
            onClick={support}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function SafetyBtn({ icon, label, sub, danger, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors"
      style={{
        background: danger ? "rgba(215,106,90,0.08)" : "rgba(244,244,240,0.03)",
        border: danger ? "1px solid rgba(215,106,90,0.25)" : "1px solid var(--line)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full grid place-items-center shrink-0"
        style={{
          background: danger ? "rgba(215,106,90,0.14)" : "var(--accent-soft)",
          color: danger ? "#d76a5a" : "var(--accent)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px]" style={{ color: danger ? "#d76a5a" : "var(--text)" }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </button>
  );
}

function ActionBtn({ icon, label, testid, onClick, badge = 0 }) {
  return (
    <button onClick={onClick} data-testid={testid} className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#17222a] border border-line hover:border-mint transition-colors">
      <span className="text-mint">{icon}</span>
      <span className="text-[10px] text-[#a8b0a8]">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center" data-testid={`${testid}-badge`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
