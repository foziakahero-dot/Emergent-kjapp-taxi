import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi } from "../lib/api";
import PremiumMap from "../components/PremiumMap";
import { Users, Car, TrendingUp, Wallet, Radio, UserPlus } from "lucide-react";

export default function FleetOverview() {
  const [me, setMe] = useState(null);
  const [ov, setOv] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const navigate = useNavigate();

  const load = () => {
    Promise.all([fleetApi.me(), fleetApi.overview(), fleetApi.drivers()])
      .then(([m, o, d]) => { setMe(m); setOv(o); setDrivers(d.drivers || []); })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const int = setInterval(() => fleetApi.drivers().then((d) => setDrivers(d.drivers || [])).catch(() => {}), 10000);
    return () => clearInterval(int);
  }, []);

  const carsOnMap = useMemo(() => {
    return drivers
      .filter((d) => d.online && d.last_lat && d.last_lng)
      .map((d) => ({ lat: d.last_lat, lng: d.last_lng, bearing: d.last_heading || 0 }));
  }, [drivers]);

  const onlineCount = carsOnMap.length;

  if (!me || !ov) return <div className="min-h-[50vh] grid place-items-center"><div className="orb orb-small" /></div>;

  return (
    <div className="page-enter" data-testid="fleet-overview">
      {/* Live fleet map — sits at the top */}
      <div className="relative" style={{ height: 260 }}>
        <PremiumMap
          center={[10.7522, 59.9139]}
          zoom={11.5}
          pitch={40}
          cars={carsOnMap}
          testid="fleet-live-map"
        />
        {/* Top overlay chip */}
        <div className="absolute left-4 top-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl" style={{ background: "rgba(14,20,26,0.72)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <Radio size={12} className={onlineCount > 0 ? "text-mint" : ""} style={onlineCount === 0 ? { color: "var(--text-muted)" } : undefined} />
          <span className="text-[11px] text-white">{onlineCount > 0 ? `${onlineCount} sjåfør${onlineCount === 1 ? "" : "er"} på vakt` : "Ingen på vakt akkurat nå"}</span>
        </div>
      </div>

      <div className="px-4 pt-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] text-mint uppercase tracking-widest">Flåte</div>
            <h1 className="font-display text-2xl text-white">{me.name}</h1>
            {me.org_number && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Org.nr {me.org_number}</div>}
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
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Brutto {ov.week.gross} kr · {ov.week.trips} turer</div>
        </div>

        {/* Drivers */}
        <div className="mt-6 flex items-center justify-between px-1">
          <h2 className="text-white text-sm font-medium">Mine sjåfører</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/fleet/drivers")} className="text-[11px] text-mint flex items-center gap-1" data-testid="fleet-invite-shortcut">
              <UserPlus size={11} /> Inviter
            </button>
            <span className="opacity-30 text-mint">·</span>
            <button onClick={() => navigate("/fleet/drivers")} className="text-[11px] text-mint" data-testid="fleet-drivers-all">Se alle</button>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          {drivers.slice(0, 4).map((d) => (
            <div key={d.id} className="card p-3 flex items-center gap-3" data-testid={`fleet-driver-${d.id}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${d.online ? "bg-mint animate-pulse" : ""}`} style={!d.online ? { background: "rgba(255,255,255,0.15)" } : undefined} />
              <div className="w-9 h-9 rounded-full bg-mint/10 grid place-items-center text-mint text-xs font-medium">
                {(d.fullName || "S").split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm truncate">{d.fullName}</div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{d.plate} · {d.car}</div>
              </div>
              <div className="text-right">
                <div className="text-white text-sm">{d.today_income} kr</div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{d.today_trips} turer i dag</div>
              </div>
            </div>
          ))}
          {drivers.length === 0 && (
            <div className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Ingen sjåfører tilknyttet ennå. Trykk «Inviter» for å sende første invitasjon.
            </div>
          )}
        </div>

        <button onClick={() => navigate("/fleet/payouts")} data-testid="fleet-payouts-link" className="btn-ghost w-full mt-6 flex items-center justify-center gap-2 text-sm">
          <Wallet size={16} /> Se alle utbetalinger
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon, testid }) {
  return (
    <div className="card p-4" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--text-muted)" }}>{icon} {label}</div>
      <div className="font-display text-2xl text-white mt-1">{value}</div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}
