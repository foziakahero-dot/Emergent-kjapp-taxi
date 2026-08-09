import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tripsApi } from "../lib/api";
import { StatusBar, Orb, ProgressRing } from "../components/UIKit";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import L from "leaflet";
import { pickupIcon, dropoffIcon, carIcon } from "../lib/mapAssets";
import { X, Phone, MessageCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_META = {
  searching: { title: "AI finner din posisjon", subtitle: "Karter din posisjon…", progress: 15 },
  booking: { title: "Bestiller for deg", subtitle: "Vi finner nærmeste sjåfør og bestiller turen for deg.", progress: 40 },
  driver_on_way: { title: "Sjåfør på vei", subtitle: "kommer om noen minutter", progress: 65 },
  in_trip: { title: "Turen din", subtitle: "km igjen", progress: 85 },
  arrived: { title: "Du er fremme!", subtitle: "Takk for turen 🙏", progress: 100 },
};

export default function BookingFlow() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
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

  const cancel = async () => {
    if (window.confirm("Avbryte turen?")) {
      await tripsApi.cancel(tripId);
      navigate("/app");
    }
  };

  if (!trip) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <Orb size="small" />
      </div>
    );
  }

  const meta = STATUS_META[trip.status] || STATUS_META.searching;
  // Use OSRM geometry if available for realistic route
  let routePoints;
  if (trip.geometry?.coordinates?.length) {
    routePoints = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else {
    routePoints = [[trip.pickup_lat, trip.pickup_lng], [trip.dropoff_lat, trip.dropoff_lng]];
  }

  // synthesize a car position between pickup and dropoff based on status
  const carProgress = trip.status === "driver_on_way" ? 0.1 : trip.status === "in_trip" ? 0.55 : trip.status === "arrived" ? 0.95 : 0;
  const carPos = [
    trip.pickup_lat + (trip.dropoff_lat - trip.pickup_lat) * carProgress,
    trip.pickup_lng + (trip.dropoff_lng - trip.pickup_lng) * carProgress,
  ];

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0" style={{ top: 0, bottom: 0 }}>
        <MapContainer center={[(trip.pickup_lat + trip.dropoff_lat) / 2, (trip.pickup_lng + trip.dropoff_lng) / 2]} zoom={13} zoomControl={false} className="w-full h-full">
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap, &copy; CartoDB'
          />
          <Marker position={[trip.pickup_lat, trip.pickup_lng]} icon={pickupIcon} />
          <Marker position={[trip.dropoff_lat, trip.dropoff_lng]} icon={dropoffIcon} />
          <Polyline positions={routePoints} pathOptions={{ color: "#2fe08c", weight: 4, opacity: 0.9 }} />
          {(trip.status === "driver_on_way" || trip.status === "in_trip") && (
            <Marker position={carPos} icon={carIcon} />
          )}
        </MapContainer>
      </div>

      {/* Top */}
      <div className="relative z-[1000] px-4 pt-2 flex items-center justify-between">
        <button onClick={cancel} data-testid="trip-cancel" className="w-10 h-10 grid place-items-center rounded-full bg-[#0e1113]/85 border border-line backdrop-blur-md">
          <X size={18} className="text-white" />
        </button>
        <div className="font-display text-lg text-white bg-[#0e1113]/85 border border-line backdrop-blur-md rounded-full px-4 py-2">
          {meta.title}
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute left-0 right-0 bottom-0 z-[1000]"
      >
        <div className="card m-4 mb-6 p-5 shadow-card backdrop-blur-xl bg-[#0e1113]/95">
          <AnimatePresence mode="wait">
            <motion.div
              key={trip.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {trip.status === "searching" || trip.status === "booking" ? (
                <div className="flex flex-col items-center py-4">
                  <ProgressRing value={meta.progress} size={120}>
                    <div className="orb orb-small" />
                  </ProgressRing>
                  <div className="mt-4 text-white text-lg font-medium">{meta.title}</div>
                  <div className="text-[#7a8388] text-sm mt-1 text-center max-w-[240px]">{meta.subtitle}</div>
                </div>
              ) : trip.status === "driver_on_way" ? (
                <div>
                  <div className="flex items-center gap-4">
                    <ProgressRing value={65} size={90} stroke={5}>
                      <div className="text-white font-display text-2xl font-semibold">{trip.eta_min || 2}</div>
                    </ProgressRing>
                    <div className="flex-1">
                      <div className="text-[11px] text-mint uppercase tracking-widest">min unna</div>
                      <div className="text-white font-medium mt-1">{trip.driver?.name}</div>
                      <div className="text-[13px] text-[#a1a7ab]">{trip.driver?.car} · {trip.driver?.plate}</div>
                      <div className="text-[12px] text-[#7a8388] flex items-center gap-1 mt-1">
                        ⭐ {trip.driver?.rating}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ActionBtn icon={<Phone size={16} />} label="Ring sjåfør" testid="action-call" />
                    <ActionBtn icon={<MessageCircle size={16} />} label="Melding" testid="action-message" />
                    <ActionBtn icon={<Shield size={16} />} label="Sikkerhet" testid="action-safety" />
                  </div>
                </div>
              ) : trip.status === "in_trip" ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] text-mint uppercase tracking-widest">Turen pågår</div>
                      <div className="text-white font-medium mt-1">{trip.dropoff_address}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl text-white">{trip.price} kr</div>
                      <div className="text-[11px] text-[#7a8388]">Estimert pris</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 py-2 border-t border-line">
                    <div className="flex-1">
                      <div className="text-[11px] text-[#7a8388]">Avstand</div>
                      <div className="text-white text-sm">{trip.distance_km} km</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] text-[#7a8388]">Tid</div>
                      <div className="text-white text-sm">{trip.duration_min} min</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] text-[#7a8388]">Betaling</div>
                      <div className="text-white text-sm">Vipps</div>
                    </div>
                  </div>
                  <button className="mt-3 w-full btn-ghost text-sm" data-testid="share-trip">Del turstatus</button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4">
                  <div className="w-20 h-20 rounded-full bg-mint grid place-items-center mint-glow">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#04120a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="mt-4 text-white text-lg font-medium">{meta.title}</div>
                  <div className="text-[#7a8388] text-sm mt-1">{meta.subtitle}</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function ActionBtn({ icon, label, testid }) {
  return (
    <button data-testid={testid} className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#141719] border border-line hover:border-mint transition-colors">
      <span className="text-mint">{icon}</span>
      <span className="text-[10px] text-[#a1a7ab]">{label}</span>
    </button>
  );
}
