import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Search, Car, Loader2 } from "lucide-react";

const CLASS_LABEL = { "ai-first": "Standard", enkelt: "Sparsom", trygg: "Komfort", premium: "Premium" };

export default function AdminVehicles() {
  const [q, setQ] = useState("");
  const [vehicles, setVehicles] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    adminApi.vehicles({ q: q || undefined })
      .then((r) => { if (alive) { setVehicles(r.vehicles); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); });
    return () => { alive = false; };
  }, [q]);

  return (
    <div className="space-y-4" data-testid="admin-vehicles">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}>
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk etter bil, skilt eller sjåfør…"
          data-testid="vehicles-search" className="bg-transparent flex-1 text-[13px] outline-none" style={{ color: "var(--text)" }} />
      </div>

      {err && <div className="card p-4 text-center text-[13px]" data-testid="vehicles-error">{err}</div>}
      {!vehicles ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="vehicles-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>
      ) : vehicles.length === 0 ? (
        <div className="card p-8 text-center" data-testid="vehicles-empty">
          <Car size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen kjøretøy matcher</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {vehicles.map((v) => (
            <div key={v.id} className="p-4 rounded-2xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid={`vehicle-card-${v.id}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Car size={16} /></div>
                <div className="flex items-center gap-2">
                  {v.online && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#2fe08c" }} />}
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(203,163,101,0.14)", color: "var(--accent)" }}>
                    {CLASS_LABEL[v.vehicle_type] || v.vehicle_type || "—"}
                  </span>
                </div>
              </div>
              <div className="font-display text-[16px]" style={{ color: "var(--text)" }}>{v.car || "Ukjent bil"}</div>
              <div className="text-[13px] font-mono mt-0.5 tracking-wider" style={{ color: "var(--accent)" }}>{v.plate || "—"}</div>
              <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                {v.driver_name || "Ingen sjåfør"}{v.fleet_name ? ` · ${v.fleet_name}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
