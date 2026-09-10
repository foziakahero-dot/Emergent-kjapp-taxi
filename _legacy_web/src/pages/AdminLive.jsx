import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import PremiumMap from "../components/PremiumMap";
import { Radio, Loader2, Car, Route as RouteIcon } from "lucide-react";

const STATUS_NO = {
  searching: "Søker sjåfør", booking: "Booket", driver_on_way: "På vei til kunde",
  at_pickup: "Venter på kunde", in_trip: "Tur pågår",
};

export default function AdminLive() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await adminApi.live();
        if (alive) { setData(r); setErr(null); }
      } catch (e) {
        if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste");
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (err) return <div className="card p-6 text-center" data-testid="live-error">{err}</div>;
  if (!data) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="live-loading"><Loader2 size={16} className="animate-spin" /> Laster live-data…</div>;

  const cars = (data.drivers || []).filter((d) => d.lat && d.lng).map((d) => ({ lat: d.lat, lng: d.lng, bearing: d.heading || 0 }));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" data-testid="admin-live">
      <div className="xl:col-span-2 rounded-2xl overflow-hidden relative" style={{ border: "1px solid var(--line)", minHeight: 480 }}>
        <PremiumMap center={[10.7461, 59.9127]} zoom={11.5} pitch={30} cars={cars} testid="live-map" className="absolute inset-0" />
        <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(6,9,10,0.82)", border: "1px solid var(--line)", backdropFilter: "blur(8px)" }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#2fe08c" }} />
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--text)" }} data-testid="live-online-count">{data.drivers.length} online</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl p-4" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="live-drivers-panel">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={14} style={{ color: "var(--accent)" }} />
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>Sjåfører online</div>
          </div>
          {data.drivers.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen sjåfører online akkurat nå</div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {data.drivers.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: "rgba(244,244,240,0.02)" }} data-testid={`live-driver-${d.id}`}>
                  <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Car size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate" style={{ color: "var(--text)" }}>{d.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{d.car} · {d.plate}{d.fleet_name ? ` · ${d.fleet_name}` : ""}</div>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: "#2fe08c" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-4" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="live-trips-panel">
          <div className="flex items-center gap-2 mb-3">
            <RouteIcon size={14} style={{ color: "var(--accent)" }} />
            <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>Aktive turer ({data.trips.length})</div>
          </div>
          {data.trips.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen aktive turer</div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {data.trips.map((t) => (
                <div key={t.trip_id} className="p-2.5 rounded-xl" style={{ background: "rgba(244,244,240,0.02)" }} data-testid={`live-trip-${t.trip_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(203,163,101,0.14)", color: "var(--accent)" }}>{STATUS_NO[t.status] || t.status}</span>
                    <span className="text-[12px] font-medium" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{t.price} kr</span>
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "var(--text)" }}>{t.pickup_address} → {t.dropoff_address}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t.passenger_name || "Kunde"}{t.driver_name ? ` · ${t.driver_name}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
