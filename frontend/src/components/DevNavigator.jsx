import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, X, User, Car, Building2, ShieldCheck, MapPin, CreditCard, MessageCircle, History, Bell, Home as HomeIcon, ClipboardList, Wallet, Users } from "lucide-react";

/**
 * Small floating developer/preview menu — lets the app owner jump between
 * any screen quickly during beta review. Hidden from real production via
 * localStorage flag; can also be shown/hidden with `?nav=off/on`.
 */
const SCREENS = [
  {
    group: "Kunde",
    items: [
      { path: "/app", label: "Hjem (kart)", Icon: HomeIcon },
      { path: "/app/ai", label: "KJAPP AI-chat", Icon: MessageCircle },
      { path: "/app/profile", label: "Profil", Icon: User },
      { path: "/app/payment-methods", label: "Betalingskort", Icon: CreditCard },
      { path: "/app/history", label: "Turhistorikk", Icon: History },
      { path: "/app/settings", label: "Innstillinger", Icon: Bell },
    ],
  },
  {
    group: "Sjåfør",
    items: [
      { path: "/driver", label: "Sjåfør — Hjem", Icon: Car },
      { path: "/driver/history", label: "Sjåfør — Historikk", Icon: History },
      { path: "/driver/payouts", label: "Sjåfør — Utbetalinger", Icon: Wallet },
      { path: "/driver/profile", label: "Sjåfør — Profil", Icon: User },
    ],
  },
  {
    group: "Flåteeier",
    items: [
      { path: "/fleet", label: "Flåte — Oversikt", Icon: Building2 },
      { path: "/fleet/drivers", label: "Flåte — Sjåfører", Icon: Users },
      { path: "/fleet/payouts", label: "Flåte — Utbetalinger", Icon: Wallet },
    ],
  },
  {
    group: "Superadmin",
    items: [
      { path: "/loyver", label: "Løyvehaver-panelet", Icon: ShieldCheck },
      { path: "/loyver/pending-drivers", label: "Nye sjåfører — venter", Icon: ClipboardList },
    ],
  },
  {
    group: "Offentlig",
    items: [
      { path: "/", label: "Onboarding", Icon: Compass },
      { path: "/login", label: "Kunde-innlogging", Icon: User },
      { path: "/driver/login", label: "Sjåfør-innlogging", Icon: Car },
      { path: "/apply/fleet", label: "Bli løyvehaver", Icon: Building2 },
    ],
  },
];

export default function DevNavigator() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Prod-gate: env flag REACT_APP_DEV_NAV controls whether the beta-navigator is available.
  // Also hides entirely if user opts out via ?nav=off in URL.
  const enabled = process.env.REACT_APP_DEV_NAV === "true" || process.env.NODE_ENV === "development";
  if (!enabled) return null;
  if (typeof window !== "undefined" && window.location.search.includes("nav=off")) return null;

  // Hide on routes that have their own bottom-right primary action (avoids overlap with chat-send / mic).
  const hideOnRoutes = ["/app/ai", "/app/booking", "/app/receipt"];
  if (hideOnRoutes.some((r) => location.pathname.startsWith(r))) return null;

  return (
    <>
      {/* Trigger button — bottom-right, always visible */}
      <button
        onClick={() => setOpen(true)}
        data-testid="dev-nav-open"
        aria-label="Utvikler-navigator"
        className="fixed z-[1200] bottom-4 right-4 w-12 h-12 rounded-full grid place-items-center transition-transform active:scale-95"
        style={{
          background: "linear-gradient(155deg, rgba(201,161,91,0.85), rgba(168,131,74,0.9))",
          boxShadow: "0 8px 30px rgba(201,161,91,0.35)",
          border: "1px solid rgba(232,224,208,0.35)",
        }}
      >
        <Compass size={18} style={{ color: "#0c1216" }} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1300] grid place-items-end sm:place-items-center px-4 py-6"
          style={{ background: "rgba(4,8,10,0.7)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[440px] max-h-[85vh] overflow-y-auto rounded-3xl p-5"
            style={{ background: "rgba(12,18,22,0.98)", border: "1px solid rgba(232,224,208,0.14)" }}
            onClick={(e) => e.stopPropagation()}
            data-testid="dev-nav-panel"
          >
            <div className="sheet-handle" />
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0" style={{ background: "rgba(201,161,91,0.14)" }}>
                <Compass size={18} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] tracking-[0.32em] uppercase" style={{ color: "var(--accent)" }}>Beta-navigator</div>
                <div className="font-display text-[20px]" style={{ color: "var(--text)" }}>Alle KJAPP-skjermer</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Krever innlogging for beskyttede sider</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                data-testid="dev-nav-close"
                className="w-9 h-9 rounded-xl grid place-items-center"
                style={{ background: "rgba(232,224,208,0.06)", color: "var(--text-muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {SCREENS.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] tracking-widest uppercase mb-2 px-1" style={{ color: "var(--text-muted)" }}>
                    {g.group}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((s) => {
                      const Ic = s.Icon || MapPin;
                      return (
                        <button
                          key={s.path}
                          onClick={() => { setOpen(false); navigate(s.path); }}
                          data-testid={`dev-nav-${s.path.replace(/\//g, "-")}`}
                          className="flex items-center gap-2 p-3 rounded-2xl text-left transition-colors"
                          style={{
                            background: "rgba(232,224,208,0.04)",
                            border: "1px solid rgba(232,224,208,0.08)",
                          }}
                        >
                          <Ic size={14} style={{ color: "var(--accent)" }} />
                          <span className="text-[12px] truncate" style={{ color: "var(--text)" }}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3 rounded-2xl text-[11px]" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.08)", color: "var(--text-muted)" }}>
              Test-konti: <span style={{ color: "var(--text)" }}>ola@kjapp.no / test1234</span> · <span style={{ color: "var(--text)" }}>sjafor@kjapp.no / sjafor1234</span> · <span style={{ color: "var(--text)" }}>floteier1@kjapp.no / fleet1234</span> · <span style={{ color: "var(--text)" }}>admin@kjapp.no / admin123</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
