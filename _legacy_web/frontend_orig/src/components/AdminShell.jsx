import React, { useEffect, useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Radio, Building2, Users, Car, Route, DollarSign, FileText, LifeBuoy, TrendingUp, ClipboardList, Settings, LogOut, Bell, ChevronRight, Gift } from "lucide-react";

/** Nordic-branded operations shell — sidebar + top bar for admin. */
export default function AdminShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const nav = [
    { path: "/admin", label: "Oversikt", Icon: LayoutDashboard, match: (p) => p === "/admin" },
    { path: "/admin/live", label: "Live drift", Icon: Radio, match: (p) => p.startsWith("/admin/live") },
    { path: "/admin/fleets", label: "Flåter", Icon: Building2, match: (p) => p === "/admin/fleets" || p.startsWith("/admin/fleets/") || p.startsWith("/loyver") },
    { path: "/admin/drivers", label: "Sjåfører", Icon: Users, match: (p) => p.startsWith("/admin/drivers") },
    { path: "/admin/vehicles", label: "Kjøretøy", Icon: Car, match: (p) => p.startsWith("/admin/vehicles") },
    { path: "/admin/trips", label: "Turer", Icon: Route, match: (p) => p.startsWith("/admin/trips") },
    { path: "/admin/bonus", label: "Bonus", Icon: Gift, match: (p) => p.startsWith("/admin/bonus") },
    { path: "/admin/finance", label: "Finans", Icon: DollarSign, match: (p) => p.startsWith("/admin/finance") },
    { path: "/admin/documents", label: "Dokumenter", Icon: FileText, match: (p) => p.startsWith("/admin/documents") },
    { path: "/admin/support", label: "Support", Icon: LifeBuoy, match: (p) => p.startsWith("/admin/support") },
    { path: "/admin/analytics", label: "Analyse", Icon: TrendingUp, match: (p) => p.startsWith("/admin/analytics") },
    { path: "/admin/audit", label: "Revisjon", Icon: ClipboardList, match: (p) => p.startsWith("/admin/audit") },
    { path: "/admin/settings", label: "Innstillinger", Icon: Settings, match: (p) => p.startsWith("/admin/settings") },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: "#080c0e", backgroundImage: "linear-gradient(180deg,#080c0e 0%,#0B1013 100%)" }}>
      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col"
        style={{
          width: collapsed ? 68 : 240,
          background: "rgba(6,9,10,0.92)",
          borderRight: "1px solid rgba(244,244,240,0.06)",
          transition: "width 260ms ease",
        }}
        data-testid="admin-sidebar"
      >
        <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(244,244,240,0.06)" }}>
          <div className="font-display leading-none" style={{ fontSize: 22, color: "var(--text)" }}>
            KJ<span style={{ color: "var(--accent)" }}>A</span>PP
          </div>
          {!collapsed && (
            <div className="text-[9px] uppercase tracking-[0.3em] ml-1 pt-1" style={{ color: "var(--accent)" }}>Control</div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {nav.map((it) => {
            const active = it.match(location.pathname);
            return (
              <Link
                key={it.path}
                to={it.path}
                data-testid={`admin-nav-${it.path.replace(/\//g, "-")}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                style={{
                  background: active ? "rgba(203,163,101,0.12)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  border: active ? "1px solid rgba(203,163,101,0.24)" : "1px solid transparent",
                }}
                title={collapsed ? it.label : undefined}
              >
                <it.Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
                {!collapsed && <span className="text-[13px]" style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>{it.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(244,244,240,0.06)" }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            data-testid="admin-sidebar-toggle"
            className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight size={14} style={{ transform: collapsed ? "none" : "rotate(180deg)" }} />
            {!collapsed && <span>Skjul meny</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-6 py-3"
          style={{ background: "rgba(6,9,10,0.72)", borderBottom: "1px solid rgba(244,244,240,0.06)", backdropFilter: "blur(12px)" }}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>Operations Control Center</div>
            <div className="font-display text-[19px]" style={{ color: "var(--text)" }} data-testid="admin-page-title">
              {(nav.find((n) => n.match(location.pathname)) || { label: "Admin" }).label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)", color: "var(--text-muted)" }} data-testid="admin-notifications">
              <Bell size={15} />
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-[12px]" style={{ color: "var(--text)" }} data-testid="admin-user-name">{user?.fullName || "Admin"}</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>{(user?.role || "admin").toUpperCase()}</div>
            </div>
            <button
              onClick={async () => { await logout(); navigate("/login"); }}
              data-testid="admin-logout"
              className="w-9 h-9 rounded-full grid place-items-center"
              style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)", color: "var(--text-muted)" }}
              aria-label="Logg ut"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6" data-testid="admin-main">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
