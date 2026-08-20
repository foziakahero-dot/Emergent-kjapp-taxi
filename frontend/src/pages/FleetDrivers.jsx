import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi } from "../lib/api";
import { ChevronLeft, Search } from "lucide-react";

export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => { fleetApi.drivers().then((r) => setDrivers(r.drivers || [])).catch(() => {}); }, []);

  const filtered = drivers.filter((d) =>
    (d.fullName || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.plate || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.car || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="fleet-drivers-page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-line">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white">Sjåfører</h1>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7a827a]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk navn, skilt eller bil"
          className="input pl-10"
          data-testid="fleet-search"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((d) => (
          <div key={d.id} className="card p-4 flex items-center gap-3" data-testid={`driver-row-${d.id}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${d.online ? "bg-mint animate-pulse" : "bg-[#263038]"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm">{d.fullName}</div>
              <div className="text-[11px] text-[#7a827a]">{d.plate} · {d.car} · {(d.rating || 5).toFixed(1)} ★</div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm">{d.today_income} kr</div>
              <div className="text-[11px] text-[#7a827a]">i dag</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card p-6 text-center text-[#7a827a] text-sm">Ingen sjåfører matcher søket</div>
        )}
      </div>
    </div>
  );
}
