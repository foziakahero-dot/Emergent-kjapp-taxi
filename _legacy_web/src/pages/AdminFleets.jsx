import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../lib/api";
import { Search, Building2, Loader2, AlertCircle, Users, DollarSign, ChevronRight } from "lucide-react";

const TABS = [
  { key: "all", label: "Alle" },
  { key: "active", label: "Aktive" },
  { key: "pending", label: "Venter" },
  { key: "suspended", label: "Suspendert" },
  { key: "rejected", label: "Avvist" },
];

export default function AdminFleets() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.fleetsFull({ status: tab, q: q || undefined })
      .then((r) => { if (alive) { setData(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab, q]);

  const fleets = data?.fleets || [];

  return (
    <div className="space-y-4" data-testid="admin-fleets">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`fleets-tab-${t.key}`}
              className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-colors"
              style={{
                background: active ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
                color: active ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${active ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}
      >
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk etter firma, orgnummer, e-post…"
          data-testid="fleets-search"
          className="bg-transparent flex-1 text-[13px] outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="fleets-loading">
          <Loader2 size={16} className="animate-spin" /> Laster…
        </div>
      ) : err ? (
        <div className="card p-6 text-center" data-testid="fleets-error"><AlertCircle size={20} className="mx-auto mb-2" style={{ color: "#d76a5a" }} /><div className="text-[13px]" style={{ color: "var(--text)" }}>{err}</div></div>
      ) : fleets.length === 0 ? (
        <div className="card p-8 text-center" data-testid="fleets-empty">
          <Building2 size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen flåter matcher filteret</div>
        </div>
      ) : (
        <div className="space-y-2">
          {fleets.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/admin/fleets/${f.id}`)}
              data-testid={`fleet-row-${f.id}`}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors hover:bg-white/[0.03]"
              style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}
            >
              <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <Building2 size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="font-display text-[15px] truncate" style={{ color: "var(--text)" }}>{f.name || "Uten navn"}</div>
                  <StatusPill status={f.status} />
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {f.org_number ? `Org ${f.org_number}` : "—"} · {f.contact_email || "—"}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-5 shrink-0">
                <Stat Icon={Users} value={f.driver_count || 0} label="sjåfører" />
                <Stat Icon={DollarSign} value={`${Math.round((f.commission_rate || 0.10) * 100)}%`} label="komm." />
              </div>
              <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const s = status || "active";
  const map = {
    active:      { bg: "rgba(47,224,140,0.12)", fg: "#2fe08c", label: "Aktiv" },
    suspended:   { bg: "rgba(215,106,90,0.14)", fg: "#d76a5a", label: "Suspendert" },
    pending:     { bg: "rgba(203,163,101,0.14)", fg: "var(--accent)", label: "Venter" },
    rejected:    { bg: "rgba(244,244,240,0.06)", fg: "var(--text-muted)", label: "Avvist" },
  };
  const m = map[s] || map.active;
  return (
    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.fg }} data-testid={`fleet-status-${s}`}>
      {m.label}
    </span>
  );
}

function Stat({ Icon, value, label }) {
  return (
    <div className="text-right">
      <div className="flex items-center gap-1 text-[13px] font-medium" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        <Icon size={12} style={{ color: "var(--text-muted)" }} />
        {value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
