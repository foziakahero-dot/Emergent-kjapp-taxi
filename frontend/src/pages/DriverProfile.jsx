import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { driverApi } from "../lib/api";
import { subscribePush } from "../lib/push";
import { LogOut, Bell, Star, Car, ChevronLeft, MapPin, Wallet, History, Shield, HelpCircle, ChevronRight, Volume2 } from "lucide-react";

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState({ income: 0, trips: 0, satisfaction: 98 });
  const [pushOn, setPushOn] = useState(false);
  const [autoNav, setAutoNav] = useState(() => localStorage.getItem("kjapp_auto_nav") === "true");
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("kjapp_driver_sound") !== "false");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    driverApi.summary().then(setSummary).catch(() => {});
    if ("Notification" in window) setPushOn(Notification.permission === "granted");
  }, []);

  const enablePush = async () => {
    setMsg("");
    // First: Notification API permission (works in-browser)
    let webOk = false;
    try {
      if ("Notification" in window) {
        const p = await Notification.requestPermission();
        webOk = p === "granted";
      }
    } catch { /* ignore */ }
    // Then: web push subscription (backend delivery)
    const res = await subscribePush();
    if (res.ok || webOk) {
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

  const initials = (user?.fullName || "?").trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="px-6 pt-2 pb-24 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/driver")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="dprof-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Profil</h1>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mint to-mint-dim grid place-items-center text-[#04120a] font-semibold text-lg" data-testid="dprof-avatar">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium" data-testid="dprof-name">{user?.fullName}</div>
          <div className="text-[13px] text-mint flex items-center gap-1">
            <Star size={12} fill="#2fe08c" /> {user?.rating?.toFixed(1) || "4.9"} · Sjåfør
          </div>
          <div className="text-[11px] text-[#7a827a] mt-0.5" data-testid="dprof-email">{user?.email}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">I dag</div><div className="font-display text-lg text-white mt-1">{summary.income} kr</div></div>
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">Turer</div><div className="font-display text-lg text-white mt-1">{summary.trips}</div></div>
        <div className="card p-3"><div className="text-[10px] text-[#7a827a] uppercase tracking-widest">Tilfredshet</div><div className="font-display text-lg text-white mt-1">{summary.satisfaction}%</div></div>
      </div>

      {/* Inntjening */}
      <div className="text-[10px] text-[#5f6862] uppercase tracking-widest px-2 mb-2">Inntjening</div>
      <div className="card divide-y divide-line mb-4">
        <Row icon={<Wallet size={18} className="text-mint" />} label="Utbetalinger" sub="Se ukesutbetalinger og bank-info" onClick={() => navigate("/driver/payouts")} testid="dprof-payouts" />
        <Row icon={<History size={18} className="text-mint" />} label="Turhistorikk" sub="Alle turer, kvitteringer og inntekter" onClick={() => navigate("/driver/history")} testid="dprof-history" />
      </div>

      {/* Kjøretøy */}
      <div className="text-[10px] text-[#5f6862] uppercase tracking-widest px-2 mb-2">Kjøretøy</div>
      <div className="card divide-y divide-line mb-4">
        <div className="w-full flex items-center gap-4 px-4 py-4">
          <Car size={18} className="text-mint" />
          <div className="flex-1">
            <div className="text-white text-sm">{user?.car || "Ikke registrert"}</div>
            <div className="text-[11px] text-[#7a827a] mt-0.5">{user?.plate || "—"}</div>
          </div>
          <span className="text-[10px] text-mint uppercase tracking-widest">{user?.vehicle_type || "standard"}</span>
        </div>
      </div>

      {/* Preferanser */}
      <div className="text-[10px] text-[#5f6862] uppercase tracking-widest px-2 mb-2">Varsler og navigasjon</div>
      <div className="card divide-y divide-line mb-4">
        <button
          onClick={enablePush}
          disabled={pushOn}
          data-testid="dprof-push"
          className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors first:rounded-t-[22px]"
        >
          <Bell size={18} className={pushOn ? "text-mint" : "text-[#7a827a]"} />
          <div className="flex-1">
            <div className="text-white text-sm">Push-varsler</div>
            <div className="text-[11px] text-[#7a827a] mt-0.5">Få signal når nye turer kommer</div>
          </div>
          <span className={`text-xs ${pushOn ? "text-mint" : "text-[#7a827a]"}`}>{pushOn ? "På" : "Slå på"}</span>
        </button>
        <button
          onClick={() => {
            const v = !soundOn;
            setSoundOn(v);
            localStorage.setItem("kjapp_driver_sound", String(v));
          }}
          data-testid="dprof-sound"
          className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors"
        >
          <Volume2 size={18} className={soundOn ? "text-mint" : "text-[#7a827a]"} />
          <div className="flex-1">
            <div className="text-white text-sm">Lyd-signal ved ny tur</div>
            <div className="text-[11px] text-[#7a827a] mt-0.5">Tredobbel piping + vibrasjon</div>
          </div>
          <span className={`text-xs ${soundOn ? "text-mint" : "text-[#7a827a]"}`}>{soundOn ? "På" : "Av"}</span>
        </button>
        <button
          onClick={() => {
            const v = !autoNav;
            setAutoNav(v);
            localStorage.setItem("kjapp_auto_nav", String(v));
          }}
          data-testid="dprof-autonav"
          className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors last:rounded-b-[22px]"
        >
          <MapPin size={18} className={autoNav ? "text-mint" : "text-[#7a827a]"} />
          <div className="flex-1">
            <div className="text-white text-sm">Auto-åpne Google Maps</div>
            <div className="text-[11px] text-[#7a827a] mt-0.5">Ved godtatt tur startes navigering</div>
          </div>
          <span className={`text-xs ${autoNav ? "text-mint" : "text-[#7a827a]"}`}>{autoNav ? "På" : "Av"}</span>
        </button>
      </div>

      {/* Konto */}
      <div className="text-[10px] text-[#5f6862] uppercase tracking-widest px-2 mb-2">Konto</div>
      <div className="card divide-y divide-line mb-4">
        <Row icon={<Shield size={18} className="text-mint" />} label="Personvern og GDPR" sub="Rettigheter, eksport og sletting" onClick={() => navigate("/privacy")} testid="dprof-privacy" />
        <Row icon={<HelpCircle size={18} className="text-mint" />} label="Kontakt support" sub="support@kjapp.no · svar innen 24t" onClick={() => window.location.href = "mailto:support@kjapp.no?subject=Sjåfør-support"} testid="dprof-support" />
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

function Row({ icon, label, sub, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#17222a] transition-colors first:rounded-t-[22px] last:rounded-b-[22px]"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm">{label}</div>
        {sub && <div className="text-[11px] text-[#7a827a] mt-0.5 truncate">{sub}</div>}
      </div>
      <ChevronRight size={14} className="text-[#7a827a]" />
    </button>
  );
}
