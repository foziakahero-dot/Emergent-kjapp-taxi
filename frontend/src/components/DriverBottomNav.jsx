import React from "react";
import { NavLink } from "react-router-dom";
import { Home as HomeIcon, TrendingUp, Clock, User as UserIcon } from "lucide-react";

/** Driver HUD nav — one-hand reach, 4 destinations. Single source of truth for driver routes. */
const ITEMS = [
  { to: "/driver", label: "Hjem", Icon: HomeIcon, testid: "dnav-home", end: true },
  { to: "/driver/payouts", label: "Inntekt", Icon: TrendingUp, testid: "dnav-earn" },
  { to: "/driver/history", label: "Turer", Icon: Clock, testid: "dnav-trips" },
  { to: "/driver/profile", label: "Konto", Icon: UserIcon, testid: "dnav-account" },
];

export default function DriverBottomNav() {
  return (
    <nav
      className="fixed left-0 right-0 z-[1005] flex items-center justify-around px-2"
      style={{
        bottom: 0,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: 8,
        background: "rgba(5,8,10,0.95)",
        backdropFilter: "blur(24px) saturate(140%)",
        borderTop: "1px solid rgba(244,244,240,0.07)",
      }}
      data-testid="driver-bottom-nav"
    >
      {ITEMS.map(({ to, label, Icon, testid, end }) => (
        <NavLink key={to} to={to} end={end} data-testid={testid} className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl" style={{ minWidth: 64 }}>
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }} />
              <span className="text-[10px]" style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
