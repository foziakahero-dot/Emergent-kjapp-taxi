import React from "react";
import { NavLink } from "react-router-dom";
import { Navigation, User } from "lucide-react";

/**
 * Driver HUD nav — 2 tabs kun. Verktøy, ikke kunst.
 * Kjør (default) = alt jobb-relatert (hjem, aktiv tur, dagen, historikk, utbetalinger)
 * Konto = profil + innstillinger
 */
export default function DriverNav() {
  const items = [
    { to: "/driver", label: "Kjør", icon: Navigation, testid: "dnav-drive" },
    { to: "/driver/profile", label: "Konto", icon: User, testid: "dnav-profile" },
  ];
  return (
    <nav
      className="tab-bar absolute bottom-0 left-0 right-0 border-t z-[1005]"
      style={{
        background: "rgba(5, 7, 8, 0.96)",
        borderColor: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="grid grid-cols-2 max-w-[440px] mx-auto">
        {items.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/driver"}
            data-testid={testid}
            className={({ isActive }) =>
              `relative flex items-center justify-center gap-2 py-3.5 transition-colors ${
                isActive ? "text-mint" : "text-[#6b7075]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="text-[13px] tracking-wide font-medium">{label}</span>
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-10"
                    style={{ background: "#2fe08c" }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
