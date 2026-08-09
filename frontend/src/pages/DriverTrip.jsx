import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi } from "../lib/api";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { motion } from "framer-motion";
import { Navigation, Phone, MessageCircle, ChevronLeft, Play, Flag } from "lucide-react";
import { Orb } from "../components/UIKit";

const PICKUP_ICON = L.divIcon({
  className: "kjapp-marker",
  html: '<div style="width:14px;height:14px;background:#2fe08c;border-radius:50%;border:3px solid #050708;box-shadow:0 0 0 4px rgba(47,224,140,0.3)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7],
});
const DROPOFF_ICON = L.divIcon({
  className: "kjapp-marker",
  html: '<div style="width:16px;height:16px;background:#fff;border-radius:3px;border:3px solid #050708"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
}

export default function DriverTrip() {
  const [trip, setTrip] = useState(null);
  const [busy, setBusy] = useState(false);
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

  const start = async () => {
    setBusy(true);
    try { await driverApi.start(trip.trip_id); await load(); } catch (e) { alert("Kunne ikke starte"); } finally { setBusy(false); }
  };
  const arrive = async () => {
    setBusy(true);
    try { await driverApi.arrive(trip.trip_id); await load(); setTimeout(() => navigate("/driver"), 1500); } catch (e) { alert("Kunne ikke fullføre"); } finally { setBusy(false); }
  };

  if (!trip) {
    return (
      <div className="px-4 pt-2 pb-24 page-enter">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate("/driver")} className="w-10 h-10 grid place-items-center text-[#7a8388]" data-testid="dtrip-back">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-white text-lg font-medium">Navigasjon</h1>
        </div>
        <div className="card p-8 text-center">
          <Orb size="small" />
          <div className="text-white text-sm mt-4">Ingen aktiv tur</div>
          <div className="text-[#7a8388] text-xs mt-1">Godta en tur fra hjem-skjermen</div>
        </div>
      </div>
    );
  }

  // Use OSRM geometry if available
  let routePoints = null;
  if (trip.geometry?.coordinates?.length) {
    routePoints = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } else {
    routePoints = [[trip.pickup_lat, trip.pickup_lng], [trip.dropoff_lat, trip.dropoff_lng]];
  }

  const statusLabel = {
    driver_on_way: "På vei til henting",
    in_trip: "Turen pågår",
    arrived: "Ankommet",
  }[trip.status] || trip.status;

  return (
    <div className="relative" style={{ height: "calc(100dvh - 44px - 80px)" }}>
      <div className="absolute inset-0">
        <MapContainer
          center={[(trip.pickup_lat + trip.dropoff_lat) / 2, (trip.pickup_lng + trip.dropoff_lng) / 2]}
          zoom={13}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap, &copy; CartoDB'
          />
          <Marker position={[trip.pickup_lat, trip.pickup_lng]} icon={PICKUP_ICON} />
          <Marker position={[trip.dropoff_lat, trip.dropoff_lng]} icon={DROPOFF_ICON} />
          <Polyline positions={routePoints} pathOptions={{ color: "#2fe08c", weight: 5, opacity: 0.9 }} />
          <FitBounds points={routePoints} />
        </MapContainer>
      </div>

      {/* Top */}
      <div className="relative z-[1000] px-4 pt-2 flex items-center justify-between">
        <button onClick={() => navigate("/driver")} className="w-10 h-10 grid place-items-center rounded-full bg-[#0e1113]/85 border border-line backdrop-blur-md" data-testid="dtrip-back-map">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="text-sm text-white bg-[#0e1113]/85 border border-line backdrop-blur-md rounded-full px-4 py-2">
          {statusLabel}
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute left-0 right-0 bottom-0 z-[1000] p-4"
      >
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-mint/10 grid place-items-center">
              <Navigation size={18} className="text-mint" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-mint uppercase tracking-widest">
                {trip.status === "driver_on_way" ? "Henting" : "Destinasjon"}
              </div>
              <div className="text-white text-sm truncate">
                {trip.status === "driver_on_way" ? trip.pickup_address : trip.dropoff_address}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold">{trip.distance_km} km</div>
              <div className="text-[11px] text-[#7a8388]">{trip.duration_min} min</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <ActionBtn icon={<Phone size={16} />} label="Ring" testid="dtrip-call" />
            <ActionBtn icon={<MessageCircle size={16} />} label="Melding" testid="dtrip-msg" />
            <ActionBtn icon={<Flag size={16} />} label="Support" testid="dtrip-support" />
          </div>

          {trip.status === "driver_on_way" && (
            <button onClick={start} disabled={busy} data-testid="dtrip-start" className="btn-primary w-full flex items-center justify-center gap-2">
              <Play size={16} /> Start tur
            </button>
          )}
          {trip.status === "in_trip" && (
            <button onClick={arrive} disabled={busy} data-testid="dtrip-arrive" className="btn-primary w-full flex items-center justify-center gap-2">
              <Flag size={16} /> Avslutt tur
            </button>
          )}
          {trip.status === "arrived" && (
            <div className="text-center py-3">
              <div className="w-14 h-14 rounded-full bg-mint grid place-items-center mint-glow mx-auto">
                <Flag size={22} className="text-[#04120a]" />
              </div>
              <div className="text-white text-sm font-medium mt-3">Tur fullført</div>
              <div className="text-[#7a8388] text-xs">+{trip.price} kr til inntekt</div>
            </div>
          )}
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
