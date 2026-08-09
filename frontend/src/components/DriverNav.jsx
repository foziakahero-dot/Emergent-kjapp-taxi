import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Map as MapIcon, BarChart3, User } from "lucide-react";

export default function DriverNav() {
  const items = [
    { to: "/driver", label: "Hjem", icon: Home, testid: "dnav-home" },
    { to: "/driver/trip", label: "Tur", icon: MapIcon, testid: "dnav-trip" },
    { to: "/driver/summary", label: "Dagen", icon: BarChart3, testid: "dnav-summary" },
    { to: "/driver/profile", label: "Meg", icon: User, testid: "dnav-profile" },
  ];
  return (
    <nav className="tab-bar absolute bottom-0 left-0 right-0 bg-[#0a0c0e]/95 backdrop-blur-xl border-t border-line z-[1005]">
      <div className="grid grid-cols-4 pt-2 px-2 max-w-[440px] mx-auto">
        {items.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/driver"}
            data-testid={testid}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 transition-colors ${isActive ? "text-mint" : "text-[#6b7075]"}`
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
