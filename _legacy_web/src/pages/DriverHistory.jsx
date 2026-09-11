import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi } from "../lib/api";
import { ChevronLeft, MapPin, X, Check, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function DriverHistory() {
  const [trips, setTrips] = useState([]);
  const [weekly, setWeekly] = useState({ days: [] });
  const [ratings, setRatings] = useState({ average: 0, count: 0, recent: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([driverApi.history(), driverApi.weeklyHistory(), driverApi.ratings()])
      .then(([h, w, r]) => { setTrips(h.trips || []); setWeekly(w); setRatings(r); })
      .finally(() => setLoading(false));
  }, []);

  const weekTotal = weekly.days?.reduce((s, d) => s + d.income, 0) || 0;
  const weekTrips = weekly.days?.reduce((s, d) => s + d.trips, 0) || 0;
  const maxDay = Math.max(1, ...(weekly.days || []).map(d => d.income));

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="driver-history-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} data-testid="history-back" className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-line">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white">Turhistorikk</h1>
      </div>

      {/* Weekly income graph */}
      <div className="card p-5">
        <div className="text-[11px] text-mint uppercase tracking-widest">Siste 7 dager</div>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="font-display text-3xl text-white">{weekTotal} kr</span>
          <span className="text-[#7a827a] text-sm">{weekTrips} turer</span>
        </div>
        <div className="mt-5 flex items-end justify-between gap-1.5 h-24">
          {weekly.days?.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-mint/40 to-mint transition-all"
                style={{ height: `${Math.max(4, (d.income / maxDay) * 88)}px` }}
                data-testid={`bar-${d.date}`}
                title={`${d.income} kr`}
              />
              <span className="text-[10px] text-[#7a827a] uppercase">{d.day_label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rating card */}
      <div className="mt-3 card p-5" data-testid="rating-card">
        <div className="text-[11px] text-mint uppercase tracking-widest flex items-center gap-2">
          <Star size={12} /> Din rating
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-display text-3xl text-white">{ratings.average || "—"}</span>
          {ratings.count > 0 && (
            <span className="text-[#7a827a] text-sm">basert på {ratings.count} vurderinger</span>
          )}
        </div>
        {ratings.count === 0 && (
          <div className="text-[12px] text-[#7a827a] mt-1">Ingen vurderinger ennå. Vær hyggelig — de kommer</div>
        )}
      </div>

      {/* Trip list */}
      <h2 className="text-white text-sm font-medium mt-6 mb-2 px-1">Siste turer</h2>
      {loading && <div className="card p-6 text-center text-[#7a827a] text-sm">Laster…</div>}
      {!loading && trips.length === 0 && (
        <div className="card p-6 text-center text-[#7a827a] text-sm">Ingen turer ennå</div>
      )}
      <div className="space-y-2">
        {trips.map((t) => (
          <motion.div
            key={t.trip_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
            data-testid={`history-${t.trip_id}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {t.status === "cancelled_by_driver" ? (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-red-500/10 text-red-400 flex items-center gap-1"><X size={10} /> Avbrutt</span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-mint/10 text-mint flex items-center gap-1"><Check size={10} /> Fullført</span>
              )}
              <span className="text-[11px] text-[#7a827a] ml-auto">
                {new Date(t.created_at).toLocaleString("nb-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className="w-2 h-2 rounded-full bg-mint" />
                <div className="w-px h-5 bg-[#263038]" />
                <div className="w-2 h-2 rounded-sm bg-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm truncate">{t.pickup_address}</div>
                <div className="text-white text-sm truncate mt-1">{t.dropoff_address}</div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">{t.price} kr</div>
                <div className="text-[11px] text-[#7a827a]">{t.distance_km} km</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
