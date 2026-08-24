import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Loader2, CheckCircle2, XCircle, Coins, Ruler, Clock, Star } from "lucide-react";

const PERIODS = [{ d: 7, label: "7 dager" }, { d: 14, label: "14 dager" }, { d: 30, label: "30 dager" }];

export default function AdminAnalytics() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    adminApi.analytics(days)
      .then((r) => { if (alive) { setData(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); });
    return () => { alive = false; };
  }, [days]);

  if (err) return <div className="card p-6 text-center" data-testid="analytics-error">{err}</div>;
  if (!data) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="analytics-loading"><Loader2 size={16} className="animate-spin" /> Laster analyse…</div>;

  const m = data.metrics;
  const maxTrips = Math.max(1, ...data.series.map((s) => s.trips));
  const maxHour = Math.max(1, ...data.hours);

  const metrics = [
    { key: "acceptance", label: "Aksept-rate", value: `${m.acceptance_rate}%`, Icon: CheckCircle2, accent: true },
    { key: "cancellation", label: "Kansellering", value: `${m.cancellation_rate}%`, Icon: XCircle, danger: m.cancellation_rate > 20 },
    { key: "avg-price", label: "Snittpris", value: `${m.avg_price} kr`, Icon: Coins },
    { key: "avg-distance", label: "Snitt-distanse", value: `${m.avg_distance_km} km`, Icon: Ruler },
    { key: "avg-duration", label: "Snitt-varighet", value: `${m.avg_duration_min} min`, Icon: Clock },
  ];

  return (
    <div className="space-y-5" data-testid="admin-analytics">
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button key={p.d} onClick={() => setDays(p.d)} data-testid={`analytics-period-${p.d}`}
            className="px-3 py-1.5 rounded-full text-[12px]"
            style={{
              background: days === p.d ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
              color: days === p.d ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${days === p.d ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
            }}>{p.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {metrics.map((k) => (
          <div key={k.key} className="rounded-2xl p-4" data-testid={`analytics-metric-${k.key}`}
            style={{
              background: k.accent ? "linear-gradient(135deg, rgba(203,163,101,0.10), rgba(203,163,101,0.02))" : "rgba(244,244,240,0.03)",
              border: `1px solid ${k.accent ? "rgba(203,163,101,0.22)" : "var(--line)"}`,
            }}>
            <k.Icon size={15} style={{ color: k.danger ? "#d76a5a" : k.accent ? "var(--accent)" : "var(--text-muted)" }} />
            <div className="font-display mt-2" style={{ fontSize: 22, color: k.danger ? "#d76a5a" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="text-[10px] uppercase tracking-[0.24em] mt-1" style={{ color: "var(--text-muted)" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trips per day */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="analytics-trips-chart">
          <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Volum</div>
          <div className="font-display text-[17px] mb-4" style={{ color: "var(--text)" }}>Turer per dag ({m.total_trips} totalt)</div>
          <div className="flex items-end gap-[3px]" style={{ height: 100 }}>
            {data.series.map((s) => (
              <div key={s.date} className="flex-1 flex flex-col justify-end gap-[1px]" title={`${s.date}: ${s.trips} turer (${s.completed} fullført, ${s.cancelled} kansellert)`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max(2, (s.completed / maxTrips) * 96)}px`, background: "linear-gradient(180deg, #CBA365, rgba(203,163,101,0.4))" }} />
                {s.cancelled > 0 && <div className="w-full" style={{ height: `${(s.cancelled / maxTrips) * 96}px`, background: "rgba(215,106,90,0.5)" }} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span>{data.series[0]?.date.slice(5)}</span>
            <span>{data.series[data.series.length - 1]?.date.slice(5)}</span>
          </div>
        </div>

        {/* Hour histogram */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="analytics-hours-chart">
          <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Etterspørsel</div>
          <div className="font-display text-[17px] mb-4" style={{ color: "var(--text)" }}>Travleste timer</div>
          <div className="flex items-end gap-[2px]" style={{ height: 100 }}>
            {data.hours.map((h, i) => (
              <div key={i} className="flex-1" title={`kl ${String(i).padStart(2, "0")}: ${h} turer`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max(2, (h / maxHour) * 96)}px`, background: h > 0 ? "rgba(203,163,101,0.55)" : "rgba(244,244,240,0.05)" }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      </div>

      {/* Top drivers */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="analytics-top-drivers">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Toppliste</div>
        <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Mest aktive sjåfører</div>
        {data.top_drivers.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen fullførte turer i perioden</div>
        ) : (
          <div className="space-y-1.5">
            {data.top_drivers.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 py-1.5" data-testid={`analytics-driver-${i}`}>
                <span className="w-6 text-[12px] font-mono text-right" style={{ color: i < 3 ? "var(--accent)" : "var(--text-muted)" }}>{i + 1}.</span>
                <span className="flex-1 text-[13px]" style={{ color: "var(--text)" }}>{d.name}</span>
                <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  <Star size={11} style={{ color: "var(--accent)" }} /> {d.trips} turer
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
