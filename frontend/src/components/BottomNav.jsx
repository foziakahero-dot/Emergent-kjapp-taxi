import React from "react";
import { NavLink } from "react-router-dom";
import { Home, MessageCircle, Clock, User } from "lucide-react";

export default function BottomNav() {
  const items = [
    { to: "/app", label: "Hjem", icon: Home, testid: "nav-home" },
    { to: "/app/ai", label: "AI", icon: MessageCircle, testid: "nav-ai" },
    { to: "/app/history", label: "Turer", icon: Clock, testid: "nav-history" },
    { to: "/app/profile", label: "Profil", icon: User, testid: "nav-profile" },
  ];
  return (
    <nav className="tab-bar absolute bottom-0 left-0 right-0 bg-[#0a0c0e]/95 backdrop-blur-xl border-t border-line z-[1005]">
      <div className="grid grid-cols-4 pt-2 px-2 max-w-[440px] mx-auto">
        {items.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/app"}
            data-testid={testid}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 transition-colors ${
                isActive ? "text-mint" : "text-[#6b7075]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="text-[11px] tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
