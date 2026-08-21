import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tripsApi } from "../lib/api";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { pickupIcon, dropoffIcon, carIconRotated } from "../lib/mapAssets";
import { computeDriverPosition } from "../lib/tripAnimation";
import ChatModal from "../components/ChatModal";
import { X, Phone, MessageCircle, ShieldCheck, Star, CreditCard, MapPin, Navigation, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_META = {
  searching: { title: "Søker sjåfør", subtitle: "Vi varsler alle ledige sjåfører nær deg", progress: 20 },
  booking: { title: "Bestiller for deg", subtitle: "Vi finner nærmeste sjåfør og bestiller turen for deg.", progress: 40 },
  driver_on_way: { title: "Sjåfør på vei", subtitle: "kommer om noen minutter", progress: 65 },
  in_trip: { title: "Turen din", subtitle: "km igjen", progress: 85 },
  arrived: { title: "Du er fremme!", subtitle: "Takk for turen", progress: 100 },
  cancelled_by_driver: { title: "Sjåføren avbrøt", subtitle: "Vi prøver å finne en annen sjåfør — eller bestill på nytt", progress: 0 },
  cancelled: { title: "Turen ble avbrutt", subtitle: "", progress: 0 },
};

export default function BookingFlow() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [carPos, setCarPos] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchTrip = async () => {
      try {
        const t = await tripsApi.get(tripId);
        if (mounted) setTrip(t);
        if (t.status === "arrived") {
          await tripsApi.complete(tripId);
          navigate(`/app/receipt/${tripId}`);
        }
      } catch (_e) { /* transient */ }
    };
    fetchTrip();
    const i = setInterval(fetchTrip, 2000);
    return () => { mounted = false; clearInterval(i); };
  }, [tripId, navigate]);

  useEffect(() => {
    if (!trip) return;
    if (trip.status !== "driver_on_way" && trip.status !== "in_trip") { setCarPos(null); return; }
    const tick = () => setCarPos(computeDriverPosition(trip));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [trip]);

  const cancel = async () => {
    if (window.confirm("Avbryte turen?")) {
      await tripsApi.cancel(tripId);
      navigate("/app");
    }
  };

  if (!trip) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <PremiumLoader label="Åpner turen din…" />
      </div>
    );
  }

  const meta = STATUS_META[trip.status] || STATUS_META.searching;
  let routePoints;
  if (trip.geometry?.coordinates?.length) {
    routePoints = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else {
    routePoints = [[trip.pickup_lat, trip.pickup_lng], [trip.dropoff_lat, trip.dropoff_lng]];
  }

  const paymentLabel = trip.payment_method === "vipps" ? "Vipps" : "Kort";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0" style={{ top: 0, bottom: 0 }}>
        <MapContainer
          center={[(trip.pickup_lat + trip.dropoff_lat) / 2, (trip.pickup_lng + trip.dropoff_lng) / 2]}
          zoom={13}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[trip.pickup_lat, trip.pickup_lng]} icon={pickupIcon} />
          <Marker position={[trip.dropoff_lat, trip.dropoff_lng]} icon={dropoffIcon} />
          <Polyline positions={routePoints} pathOptions={{ color: "#c9a15b", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={routePoints} pathOptions={{ color: "#f4ecd8", weight: 1.4, opacity: 0.9, className: "polyline-shimmer" }} />
          {(trip.status === "driver_on_way" || trip.status === "in_trip") && carPos && (
            <Marker position={[carPos.lat, carPos.lng]} icon={carIconRotated(carPos.bearing)} />
          )}
        </MapContainer>
      </div>

      {/* Top row — close + status chip */}
      <div className="relative z-[1000] px-4 pt-3 flex items-center justify-between">
        <button
          onClick={cancel}
          data-testid="trip-cancel"
          className="w-11 h-11 grid place-items-center rounded-full backdrop-blur-xl"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)" }}
        >
          <X size={18} style={{ color: "var(--text)" }} />
        </button>
        <div
          className="font-display text-[17px] backdrop-blur-xl rounded-full px-5 py-2.5"
          style={{ background: "rgba(12,18,22,0.72)", border: "1px solid rgba(232,224,208,0.14)", color: "var(--text)" }}
        >
          {meta.title}
        </div>
        <div className="w-11 h-11" />
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute left-0 right-0 bottom-0 z-[1000]"
      >
        <div
          className="card m-4 mb-6 p-5"
          style={{
            background: "rgba(12,18,22,0.94)",
            border: "1px solid rgba(232,224,208,0.10)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
          }}
        >
          <div className="sheet-handle" />
          <AnimatePresence mode="wait">
            <motion.div
              key={trip.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {trip.status === "searching" || trip.status === "booking" ? (
                <SearchingState trip={trip} meta={meta} onCancel={cancel} />
              ) : trip.status === "driver_on_way" ? (
                <div>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-[74px] h-[74px] rounded-full grid place-items-center shrink-0"
                      style={{
                        background: "linear-gradient(135deg, rgba(201,161,91,0.20), rgba(201,161,91,0.06))",
                        border: "1px solid rgba(201,161,91,0.30)",
                      }}
                    >
                      <div className="text-center">
                        <div className="font-display text-[26px] leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{trip.eta_min || 2}</div>
                        <div className="text-[9px] mt-1 tracking-widest uppercase" style={{ color: "var(--accent)" }}>min</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Sjåfør på vei</div>
                      <div className="font-medium mt-1 truncate" style={{ color: "var(--text)" }}>{trip.driver?.name || "Din sjåfør"}</div>
                      <div className="text-[13px] truncate" style={{ color: "var(--text-muted)" }}>{trip.driver?.car || "Bil"} · {trip.driver?.plate || ""}</div>
                      <div className="text-[12px] flex items-center gap-1 mt-1" style={{ color: "var(--text-muted)" }}>
                        <Star size={12} fill="currentColor" style={{ color: "var(--accent)" }} /> {trip.driver?.rating || "5.0"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ActionBtn icon={<Phone size={16} />} label="Ring" testid="action-call" onClick={() => setCallOpen(true)} />
                    <ActionBtn icon={<MessageCircle size={16} />} label="Melding" testid="action-message" onClick={() => setChatOpen(true)} />
                    <ActionBtn icon={<ShieldCheck size={16} />} label="Sikkerhet" testid="action-safety" onClick={() => setSafetyOpen(true)} />
                  </div>
                </div>
              ) : trip.status === "in_trip" ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Turen pågår</div>
                      <div className="font-medium mt-1 truncate" style={{ color: "var(--text)" }}>{trip.dropoff_address}</div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="font-display text-[28px] leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{trip.price} kr</div>
                      <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Estimert</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 py-3 border-t" style={{ borderColor: "rgba(232,224,208,0.10)" }}>
                    <MetricCell label="Avstand" value={`${trip.distance_km} km`} />
                    <div className="w-px self-stretch" style={{ background: "rgba(232,224,208,0.10)" }} />
                    <MetricCell label="Tid" value={`${trip.duration_min} min`} />
                    <div className="w-px self-stretch" style={{ background: "rgba(232,224,208,0.10)" }} />
                    <MetricCell label="Betaling" value={paymentLabel} icon={<CreditCard size={12} />} />
                  </div>
                  <button onClick={() => setChatOpen(true)} className="mt-3 w-full btn-ghost text-sm flex items-center justify-center gap-2" data-testid="ontrip-chat">
                    <MessageCircle size={14} /> Melding til sjåfør
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4">
                  <div
                    className="w-20 h-20 rounded-full grid place-items-center"
                    style={{
                      background: "linear-gradient(135deg, var(--accent), rgba(201,161,91,0.7))",
                      boxShadow: "0 8px 40px var(--accent-glow)",
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="var(--accent-on)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="mt-4 font-display text-[22px]" style={{ color: "var(--text)" }}>{meta.title}</div>
                  <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{meta.subtitle}</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} tripId={tripId} role="passenger" />
      <AnimatePresence>
        {safetyOpen && <SafetyModal onClose={() => setSafetyOpen(false)} trip={trip} />}
        {callOpen && <CallModal onClose={() => setCallOpen(false)} trip={trip} />}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   Small premium subcomponents
   ============================================================ */

function ActionBtn({ icon, label, testid, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-colors"
      style={{ background: "rgba(232,224,208,0.05)", border: "1px solid rgba(232,224,208,0.10)" }}
    >
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <span className="text-[11px]" style={{ color: "var(--text)" }}>{label}</span>
    </button>
  );
}

function MetricCell({ label, value, icon }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
}

function PremiumLoader({ label = "" }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: "var(--accent)",
              animation: `dot-pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      {label && <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>{label}</div>}
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SearchingState({ trip, meta, onCancel }) {
  const [dots, setDots] = React.useState(1);
  React.useEffect(() => {
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 550);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center py-3">
      {/* Radar rings — subtle, brass */}
      <div className="relative w-[130px] h-[130px] mb-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full"
            style={{
              border: "1px solid rgba(201,161,91,0.35)",
              animation: `radar-pulse 2.4s ease-out ${i * 0.8}s infinite`,
            }}
          />
        ))}
        <div
          className="absolute inset-[36%] rounded-full"
          style={{
            background: "linear-gradient(135deg, var(--accent), rgba(201,161,91,0.7))",
            boxShadow: "0 6px 30px var(--accent-glow)",
          }}
        />
      </div>
      <div className="font-display text-[22px]" style={{ color: "var(--text)" }}>
        {meta.title}{".".repeat(dots)}
      </div>
      <div className="text-sm text-center mt-1.5 max-w-[280px]" style={{ color: "var(--text-muted)" }}>
        {meta.subtitle}
      </div>
      <div
        className="mt-4 w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl"
        style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
      >
        <MapPin size={16} style={{ color: "var(--accent)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Til</div>
          <div className="text-sm truncate" style={{ color: "var(--text)" }}>{trip?.dropoff_address}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Estimert</div>
          <div className="font-display text-[16px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{trip?.price} kr</div>
        </div>
      </div>
      <button
        onClick={onCancel}
        data-testid="searching-cancel"
        className="mt-3 text-sm underline underline-offset-4"
        style={{ color: "var(--text-muted)" }}
      >
        Avbryt søk
      </button>
      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function SafetyModal({ onClose, trip }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[1100] grid place-items-end sm:place-items-center px-4 pb-8"
      style={{ background: "rgba(4,8,10,0.72)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] p-5 rounded-3xl"
        style={{ background: "rgba(12,18,22,0.98)", border: "1px solid rgba(232,224,208,0.14)" }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
            <ShieldCheck size={20} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="font-display text-[20px]" style={{ color: "var(--text)" }}>Sikkerhet</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Turen er sporet i sanntid</div>
          </div>
        </div>
        <SafetyRow href="tel:112" label="Ring nødetatene" sub="112 — politi / brann / ambulanse" danger />
        <SafetyRow href="mailto:support@kjapp.no" label="Kontakt KJAPP-support" sub="support@kjapp.no · 24/7" />
        <button
          onClick={() => {
            const url = `${window.location.origin}/app/booking/${trip.id || trip.trip_id}`;
            navigator.clipboard?.writeText(url);
          }}
          className="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors text-left"
          style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
        >
          <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(232,224,208,0.06)" }}>
            <Copy size={16} style={{ color: "var(--text)" }} />
          </div>
          <div className="flex-1">
            <div className="text-sm" style={{ color: "var(--text)" }}>Del turen med en du stoler på</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Kopier live-lenke</div>
          </div>
        </button>
        <button onClick={onClose} className="w-full mt-4 btn-ghost" data-testid="safety-close">Lukk</button>
      </motion.div>
    </motion.div>
  );
}

function SafetyRow({ href, label, sub, danger }) {
  return (
    <a
      href={href}
      className="w-full mb-2 flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
      style={{
        background: danger ? "rgba(215,106,90,0.10)" : "rgba(232,224,208,0.04)",
        border: `1px solid ${danger ? "rgba(215,106,90,0.30)" : "rgba(232,224,208,0.08)"}`,
      }}
    >
      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: danger ? "rgba(215,106,90,0.18)" : "rgba(232,224,208,0.06)" }}>
        {danger ? <Phone size={16} style={{ color: "#e39e5c" }} /> : <MessageCircle size={16} style={{ color: "var(--accent)" }} />}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: danger ? "#e8c9b0" : "var(--text)" }}>{label}</div>
        <div className="text-[11px]" style={{ color: danger ? "rgba(232,201,176,0.7)" : "var(--text-muted)" }}>{sub}</div>
      </div>
    </a>
  );
}

function CallModal({ onClose, trip }) {
  const number = trip.driver?.phone || "+47 400 00 000";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[1100] grid place-items-end sm:place-items-center px-4 pb-8"
      style={{ background: "rgba(4,8,10,0.72)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] p-5 rounded-3xl"
        style={{ background: "rgba(12,18,22,0.98)", border: "1px solid rgba(232,224,208,0.14)" }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
            <Phone size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[20px] truncate" style={{ color: "var(--text)" }}>{trip.driver?.name || "Din sjåfør"}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{trip.driver?.car || "Bil"} · {trip.driver?.plate || ""}</div>
          </div>
        </div>
        <div
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl mb-4"
          style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)" }}
        >
          <span className="font-mono text-[18px]" style={{ color: "var(--text)" }}>{number}</span>
        </div>
        <a href={`tel:${number.replace(/\s/g, "")}`} className="btn-primary w-full flex items-center justify-center gap-2 mb-2" data-testid="call-do">
          <Phone size={16} /> Ring nå
        </a>
        <button onClick={onClose} className="w-full btn-ghost" data-testid="call-close">Avbryt</button>
      </motion.div>
    </motion.div>
  );
}
