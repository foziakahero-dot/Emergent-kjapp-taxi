import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../lib/api";
import { Building2, Users, Radio, Route, DollarSign, LifeBuoy, TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react";

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await adminApi.overview();
        if (alive) { setData(r); setErr(null); }
      } catch (e) {
        if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="overview-loading"><Loader2 size={16} className="animate-spin" /> Laster KPI-er…</div>;
  if (err) return <div className="card p-6 text-center" data-testid="overview-error"><AlertCircle size={22} className="mx-auto mb-2" style={{ color: "#d76a5a" }} /><div className="text-[14px]" style={{ color: "var(--text)" }}>{err}</div></div>;
  if (!data) return null;

  const trend = data.trips.today - data.trips.yesterday;
  const trendPct = data.trips.yesterday ? Math.round((trend / data.trips.yesterday) * 100) : 0;

  const kpis = [
    { key: "fleets-active",    label: "Aktive flåter",     value: data.fleets.active, sub: `${data.fleets.pending_applications} søknader venter`, Icon: Building2, to: "/admin/fleets" },
    { key: "drivers-approved", label: "Godkjente sjåfører", value: data.drivers.approved, sub: `${data.drivers.pending} venter`, Icon: Users, to: "/admin/drivers" },
    { key: "drivers-online",   label: "Online nå",         value: data.drivers.online, sub: "Live", Icon: Radio, to: "/admin/live", accent: true },
    { key: "trips-active",     label: "Aktive turer",      value: data.trips.active, sub: `${data.trips.today} i dag`, Icon: Route, to: "/admin/trips" },
    { key: "gmv-today",        label: "GMV i dag",         value: `${data.finance.gmv_today.toLocaleString("no-NO")} kr`, sub: `${data.finance.kjapp_revenue_today.toLocaleString("no-NO")} kr til KJAPP`, Icon: DollarSign, to: "/admin/finance", accent: true },
    { key: "support-open",     label: "Åpne saker",        value: data.support.open, sub: `${data.finance.pending_payouts} utbetalinger venter`, Icon: LifeBuoy, to: "/admin/support" },
  ];

  return (
    <div className="space-y-6" data-testid="admin-overview">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <button
            key={k.key}
            onClick={() => navigate(k.to)}
            data-testid={`kpi-${k.key}`}
            className="rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
            style={{
              background: k.accent ? "linear-gradient(135deg, rgba(203,163,101,0.10), rgba(203,163,101,0.02))" : "rgba(244,244,240,0.03)",
              border: `1px solid ${k.accent ? "rgba(203,163,101,0.22)" : "var(--line)"}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <k.Icon size={16} style={{ color: k.accent ? "var(--accent)" : "var(--text-muted)" }} />
              {k.key === "drivers-online" && data.drivers.online > 0 && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#2fe08c" }} />
              )}
            </div>
            <div className="font-display leading-tight" style={{ fontSize: 24, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="text-[10px] uppercase tracking-[0.24em] mt-1" style={{ color: "var(--text-muted)" }}>{k.label}</div>
            <div className="text-[11px] mt-1.5" style={{ color: k.accent ? "var(--accent)" : "var(--text-muted)" }}>{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Secondary — trip breakdown + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl p-5 lg:col-span-2" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="overview-trip-breakdown">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>I dag vs i går</div>
              <div className="font-display text-[19px]" style={{ color: "var(--text)" }}>Turaktivitet</div>
            </div>
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: trend >= 0 ? "#2fe08c" : "#d76a5a" }}>
              {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {trend >= 0 ? "+" : ""}{trendPct}%
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <MiniStat label="I dag" value={data.trips.today} accent />
            <MiniStat label="I går" value={data.trips.yesterday} />
            <MiniStat label="Fullført i dag" value={data.trips.completed_today} />
            <MiniStat label="Kansellert" value={data.trips.cancelled_today} tone="danger" />
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="overview-fleet-health">
          <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--accent)" }}>Flåte-helse</div>
          <div className="font-display text-[19px] mb-3" style={{ color: "var(--text)" }}>Nettverk</div>
          <div className="space-y-2">
            <RowStat label="Aktive flåter" value={data.fleets.active} />
            <RowStat label="Suspenderte" value={data.fleets.suspended} tone={data.fleets.suspended > 0 ? "warn" : "muted"} />
            <RowStat label="Søknader" value={data.fleets.pending_applications} tone={data.fleets.pending_applications > 0 ? "accent" : "muted"} />
          </div>
        </div>
      </div>

      <div className="text-[10px]" style={{ color: "var(--text-muted)" }} data-testid="overview-updated">
        Oppdatert {data.as_of ? new Date(data.as_of).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }) : "—"} · Oppdaterer hvert 30. sek
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent, tone }) {
  const color = accent ? "var(--accent)" : tone === "danger" ? "#d76a5a" : "var(--text)";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-display leading-none mt-1" style={{ fontSize: 22, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function RowStat({ label, value, tone }) {
  const color = tone === "accent" ? "var(--accent)" : tone === "warn" ? "#d76a5a" : "var(--text)";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-display leading-none" style={{ fontSize: 16, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
