import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi } from "../lib/api";
import { ChevronLeft, Users, Car, TrendingUp, Wallet } from "lucide-react";

export default function FleetOverview() {
  const [me, setMe] = useState(null);
  const [ov, setOv] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([fleetApi.me(), fleetApi.overview(), fleetApi.drivers()])
      .then(([m, o, d]) => { setMe(m); setOv(o); setDrivers(d.drivers || []); })
      .catch(() => {});
  }, []);

  if (!me || !ov) return <div className="min-h-[50vh] grid place-items-center"><div className="orb orb-small" /></div>;

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="fleet-overview">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] text-mint uppercase tracking-widest">Flåte</div>
          <h1 className="font-display text-2xl text-white">{me.name}</h1>
          {me.org_number && <div className="text-[11px] text-[#8a94a8]">Org.nr {me.org_number}</div>}
        </div>
        <div className="w-11 h-11 rounded-full bg-mint/15 grid place-items-center">
          <Car size={20} className="text-mint" />
        </div>
      </div>

      {/* Live snapshot */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Sjåfører" value={`${ov.drivers_online} / ${ov.drivers_total}`} sub="på vakt nå" icon={<Users size={12} />} testid="fleet-drivers-online" />
        <Stat label="Turer i dag" value={ov.today.trips} sub={`${ov.today.gross} kr brutto`} icon={<TrendingUp size={12} />} testid="fleet-trips-today" />
      </div>

      <div className="mt-3 card p-5">
        <div className="text-[11px] text-mint uppercase tracking-widest flex items-center gap-2">
          <Wallet size={12} /> Uke-inntekt (netto etter {ov.commission_pct}% avgift)
        </div>
        <div className="mt-1 font-display text-4xl text-white" data-testid="fleet-week-net">{ov.week.net} kr</div>
        <div className="text-[13px] text-[#8a94a8]">Brutto {ov.week.gross} kr · {ov.week.trips} turer</div>
      </div>

      {/* Drivers */}
      <div className="mt-6 flex items-center justify-between px-1">
        <h2 className="text-white text-sm font-medium">Mine sjåfører</h2>
        <button onClick={() => navigate("/fleet/drivers")} className="text-[11px] text-mint" data-testid="fleet-drivers-all">Se alle</button>
      </div>
      <div className="mt-2 space-y-2">
        {drivers.slice(0, 4).map((d) => (
          <div key={d.id} className="card p-3 flex items-center gap-3" data-testid={`fleet-driver-${d.id}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${d.online ? "bg-mint animate-pulse" : "bg-[#2a3550]"}`} />
            <div className="w-9 h-9 rounded-full bg-mint/10 grid place-items-center text-mint text-xs font-medium">
              {(d.fullName || "S").split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm truncate">{d.fullName}</div>
              <div className="text-[11px] text-[#8a94a8]">{d.plate} · {d.car}</div>
            </div>
            <div className="text-right">
              <div className="text-white text-sm">{d.today_income} kr</div>
              <div className="text-[11px] text-[#8a94a8]">{d.today_trips} turer i dag</div>
            </div>
          </div>
        ))}
        {drivers.length === 0 && (
          <div className="card p-6 text-center text-[#8a94a8] text-sm">
            Ingen sjåfører tilknyttet ennå. Kontakt KJAPP-admin for å legge til.
          </div>
        )}
      </div>

      <button onClick={() => navigate("/fleet/payouts")} data-testid="fleet-payouts-link" className="btn-ghost w-full mt-6 flex items-center justify-center gap-2 text-sm">
        <Wallet size={16} /> Se alle utbetalinger
      </button>
    </div>
  );
}

function Stat({ label, value, sub, icon, testid }) {
  return (
    <div className="card p-4" data-testid={testid}>
      <div className="text-[10px] text-[#8a94a8] uppercase tracking-widest flex items-center gap-1">{icon} {label}</div>
      <div className="font-display text-2xl text-white mt-1">{value}</div>
      <div className="text-[11px] text-[#8a94a8]">{sub}</div>
    </div>
  );
}
