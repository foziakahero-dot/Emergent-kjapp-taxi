import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribePush } from "../lib/push";
import { User, CreditCard, Heart, Settings as SettingsIcon, HelpCircle, Info, LogOut, ChevronRight, ChevronLeft, Bell } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pushOn, setPushOn] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const [msg, setMsg] = useState("");
  const initial = (user?.fullName || user?.email || "?").trim()[0]?.toUpperCase();

  const enablePush = async () => {
    setMsg("");
    const res = await subscribePush();
    if (res.ok) { setPushOn(true); setMsg("Push-varsler er slått på ✨"); }
    else setMsg(res.reason === "denied" ? "Blokkert. Slå på i innstillinger." : "Kunne ikke slå på varsler.");
  };

  const items = [
    { icon: Bell, label: pushOn ? "Push-varsler: På" : "Slå på push-varsler", to: null, testid: "profile-push", onClick: enablePush, active: pushOn },
    { icon: User, label: "Profil", to: null, testid: "profile-profile" },
    { icon: CreditCard, label: "Betaling", to: "/app/payment", testid: "profile-payment" },
    { icon: Heart, label: "Favoritter", to: null, testid: "profile-favorites" },
    { icon: SettingsIcon, label: "Innstillinger", to: "/app/settings", testid: "profile-settings" },
    { icon: HelpCircle, label: "Hjelp og support", to: "/app/help", testid: "profile-help" },
    { icon: Info, label: "Om KJAPP", to: null, testid: "profile-about" },
  ];

  return (
    <div className="px-6 pt-2 pb-24 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/app")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a8388]" data-testid="profile-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Profil</h1>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mint to-mint-dim grid place-items-center text-[#04120a] font-semibold text-lg">
          {initial}
        </div>
        <div>
          <div className="text-white font-medium">{user?.fullName || "Bruker"}</div>
          <div className="text-[13px] text-[#7a8388]">{user?.email}</div>
        </div>
      </div>

      <div className="card divide-y divide-line">
        {items.map(({ icon: Icon, label, to, testid, onClick, active }) => (
          <button
            key={label}
            onClick={() => (onClick ? onClick() : to && navigate(to))}
            data-testid={testid}
            className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-[#141719] transition-colors first:rounded-t-[22px] last:rounded-b-[22px]"
          >
            <Icon size={18} className={active ? "text-mint" : "text-mint"} />
            <span className="flex-1 text-white text-sm">{label}</span>
            <ChevronRight size={16} className="text-[#7a8388]" />
          </button>
        ))}
      </div>

      {msg && <div className="mt-3 text-center text-[13px] text-mint" data-testid="profile-msg">{msg}</div>}

      <button
        onClick={async () => { await logout(); navigate("/login"); }}
        data-testid="profile-logout"
        className="mt-6 w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-line hover:border-red-500/30 hover:bg-red-500/5 transition-colors text-left"
      >
        <LogOut size={18} className="text-red-400" />
        <span className="text-red-400 text-sm font-medium">Logg ut</span>
      </button>

      <div className="mt-8 pb-4 text-center">
        <div className="font-display text-white text-lg">
          KJ<span className="text-mint">A</span>PP
        </div>
        <div className="text-[10px] text-[#7a8388] tracking-widest mt-1 uppercase">
          AI som jobber for deg, ikke motsatt.
        </div>
        <div className="text-[10px] text-[#5a6166] mt-3">Versjon 2.0.0</div>
      </div>
    </div>
  );
}
