import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { driverApi } from "../lib/api";
import { subscribePush } from "../lib/push";
import { LogOut, Bell, Star, Car, ChevronLeft, MapPin } from "lucide-react";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState({ income: 0, trips: 0, satisfaction: 98 });
  const [pushOn, setPushOn] = useState(false);
  const [autoNav, setAutoNav] = useState(() => localStorage.getItem("kjapp_auto_nav") === "true");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    driverApi.summary().then(setSummary).catch(() => {});
    if ("Notification" in window) setPushOn(Notification.permission === "granted");
  }, []);

  const enablePush = async () => {
    setMsg("");
    const res = await subscribePush();
    if (res.ok) {
      setPushOn(true);
      setMsg("Push-varsler er slått på");
    } else {
      setMsg(
        res.reason === "denied"
          ? "Du blokkerte varsler. Slå på i nettleser-innstillinger."
          : res.reason === "unsupported"
          ? "Enheten din støtter ikke push-varsler."
          : "Kunne ikke slå på varsler."
      );
    }
  };

  return (
    <div className="px-6 pt-2 pb-24 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/driver")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="dprof-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Profil</h1>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mint to-mint-dim grid place-items-center text-[#04120a] font-semibold text-lg">
          {(user?.fullName || "?").trim()[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-white font-medium">{user?.fullName}</div>
          <div className="text-[13px] text-mint flex items-center gap-1">
            <Star size={12} fill="#2fe08c" /> 4.9 · Sjåfør
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">I dag</div><div className="font-display text-lg text-white mt-1">{summary.income} kr</div></div>
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">Turer</div><div className="font-display text-lg text-white mt-1">{summary.trips}</div></div>
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">Tilfredshet</div><div className="font-display text-lg text-white mt-1">{summary.satisfaction}%</div></div>
      </div>

      <div className="card divide-y divide-line">
        <button onClick={enablePush} disabled={pushOn} data-testid="dprof-push" className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors first:rounded-t-[22px]">
          <Bell size={18} className={pushOn ? "text-mint" : "text-[#7a827a]"} />
          <span className="flex-1 text-white text-sm">Push-varsler</span>
          <span className={`text-xs ${pushOn ? "text-mint" : "text-[#7a827a]"}`}>{pushOn ? "På" : "Slå på"}</span>
        </button>
        <button
          onClick={() => {
            const v = !autoNav;
            setAutoNav(v);
            localStorage.setItem("kjapp_auto_nav", String(v));
          }}
          data-testid="dprof-autonav"
          className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors"
        >
          <MapPin size={18} className={autoNav ? "text-mint" : "text-[#7a827a]"} />
          <span className="flex-1 text-white text-sm">Auto-åpne Google Maps ved ny tur</span>
          <span className={`text-xs ${autoNav ? "text-mint" : "text-[#7a827a]"}`}>{autoNav ? "På" : "Slå på"}</span>
        </button>
        <div className="w-full flex items-center gap-4 px-4 py-4 last:rounded-b-[22px]">
          <Car size={18} className="text-mint" />
          <span className="flex-1 text-white text-sm">Bil</span>
          <span className="text-[#7a827a] text-xs">{user?.driver_id || "car-1"}</span>
        </div>
      </div>

      {msg && (
        <div className="mt-3 text-center text-[13px] text-mint" data-testid="dprof-msg">{msg}</div>
      )}

      <button
        onClick={async () => { await logout(); navigate("/login"); }}
        data-testid="dprof-logout"
        className="mt-6 w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-line hover:border-red-500/30 hover:bg-red-500/5 transition-colors text-left"
      >
        <LogOut size={18} className="text-red-400" />
        <span className="text-red-400 text-sm font-medium">Logg ut</span>
      </button>
    </div>
  );
}
