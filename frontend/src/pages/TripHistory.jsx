import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { tripsApi } from "../lib/api";
import { Clock, MapPin, ChevronRight, ChevronLeft } from "lucide-react";

const STATUS_LABEL = {
  searching: "Søker sjåfør",
  booking: "Bestiller",
  driver_on_way: "Sjåfør på vei",
  in_trip: "Underveis",
  arrived: "Fullført",
  completed: "Fullført",
  rated: "Fullført",
  cancelled: "Avbrutt",
};

export default function TripHistory() {
  const [trips, setTrips] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    tripsApi.list().then(setTrips);
  }, []);

  const total = trips.filter((t) => ["completed", "rated"].includes(t.status)).reduce((s, t) => s + (t.price || 0), 0);

  return (
    <div className="px-4 pt-2 pb-24 page-enter">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate("/app")} className="w-10 h-10 grid place-items-center text-[#8a94a8]" data-testid="history-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Turer</h1>
      </div>
      <div className="px-2 mb-4">
        <p className="text-[#8a94a8] text-sm">Dine reiser med KJAPP</p>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-mint uppercase tracking-widest">Totalt brukt</div>
            <div className="font-display text-2xl text-white mt-1">{total.toLocaleString("nb-NO")} kr</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#8a94a8]">Turer</div>
            <div className="font-display text-2xl text-white mt-1">{trips.length}</div>
          </div>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="text-center pt-16">
          <div className="orb orb-tiny mx-auto" />
          <div className="text-[#8a94a8] text-sm mt-4">Ingen turer ennå.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((t) => (
            <button
              key={t.trip_id}
              onClick={() => {
                if (["searching", "booking", "driver_on_way", "in_trip", "arrived"].includes(t.status)) {
                  navigate(`/app/booking/${t.trip_id}`);
                } else {
                  navigate(`/app/receipt/${t.trip_id}`);
                }
              }}
              data-testid={`trip-${t.trip_id}`}
              className="w-full text-left card p-4 hover:border-mint transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1.5">
                  <div className="w-2 h-2 rounded-full bg-mint" />
                  <div className="w-px h-5 bg-[#2a3550]" />
                  <div className="w-2 h-2 rounded-sm bg-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{t.pickup_address}</div>
                  <div className="text-white text-sm truncate mt-1">{t.dropoff_address}</div>
                  <div className="text-[11px] text-[#8a94a8] mt-1">
                    {STATUS_LABEL[t.status] || t.status} · {new Date(t.created_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-medium">{t.price} kr</div>
                  <ChevronRight size={16} className="text-[#8a94a8] mt-1 ml-auto" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
