import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { DollarSign, Download, Loader2, Route as RouteIcon, Percent, Coins } from "lucide-react";

const PERIODS = [{ d: 7, label: "7 dager" }, { d: 30, label: "30 dager" }, { d: 90, label: "90 dager" }];

export default function AdminFinance() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    adminApi.finance(days)
      .then((r) => { if (alive) { setData(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); });
    return () => { alive = false; };
  }, [days]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const blob = await adminApi.financeExport(days);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `kjapp_finans_${days}d.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setErr("Nedlasting feilet"); }
    finally { setDownloading(false); }
  };

  if (err) return <div className="card p-6 text-center" data-testid="finance-error">{err}</div>;
  if (!data) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="finance-loading"><Loader2 size={16} className="animate-spin" /> Laster finans…</div>;

  const maxGmv = Math.max(1, ...data.series.map((s) => s.gmv));
  const kpis = [
    { key: "gmv", label: "GMV", value: `${data.totals.gmv.toLocaleString("no-NO")} kr`, Icon: DollarSign, accent: true },
    { key: "revenue", label: "KJAPP-provisjon", value: `${data.totals.kjapp_revenue.toLocaleString("no-NO")} kr`, Icon: Percent, accent: true },
    { key: "trips", label: "Fullførte turer", value: data.totals.trips, Icon: RouteIcon },
    { key: "avg", label: "Snittpris", value: `${data.totals.avg_price} kr`, Icon: Coins },
  ];

  return (
    <div className="space-y-5" data-testid="admin-finance">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button key={p.d} onClick={() => setDays(p.d)} data-testid={`finance-period-${p.d}`}
              className="px-3 py-1.5 rounded-full text-[12px]"
              style={{
                background: days === p.d ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
                color: days === p.d ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${days === p.d ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
              }}>{p.label}</button>
          ))}
        </div>
        <button onClick={downloadCsv} disabled={downloading} data-testid="finance-export-csv"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px]"
          style={{ background: "rgba(203,163,101,0.14)", color: "var(--accent)", border: "1px solid rgba(203,163,101,0.28)" }}>
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Last ned CSV
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-2xl p-4" data-testid={`finance-kpi-${k.key}`}
            style={{
              background: k.accent ? "linear-gradient(135deg, rgba(203,163,101,0.10), rgba(203,163,101,0.02))" : "rgba(244,244,240,0.03)",
              border: `1px solid ${k.accent ? "rgba(203,163,101,0.22)" : "var(--line)"}`,
            }}>
            <k.Icon size={15} style={{ color: k.accent ? "var(--accent)" : "var(--text-muted)" }} />
            <div className="font-display mt-2" style={{ fontSize: 22, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="text-[10px] uppercase tracking-[0.24em] mt-1" style={{ color: "var(--text-muted)" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Daily GMV bar chart */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="finance-chart">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Daglig omsetning</div>
        <div className="font-display text-[18px] mb-4" style={{ color: "var(--text)" }}>GMV per dag</div>
        <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
          {data.series.map((s) => (
            <div key={s.date} className="flex-1 group relative" title={`${s.date}: ${s.gmv} kr · ${s.trips} turer`}>
              <div className="w-full rounded-t transition-colors" style={{
                height: `${Math.max(2, (s.gmv / maxGmv) * 118)}px`,
                background: s.gmv > 0 ? "linear-gradient(180deg, #CBA365, rgba(203,163,101,0.35))" : "rgba(244,244,240,0.05)",
              }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span>{data.series[0]?.date.slice(5)}</span>
          <span>{data.series[data.series.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      {/* Per-fleet table */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="finance-fleets">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Per flåte</div>
        <div className="font-display text-[18px] mb-3" style={{ color: "var(--text)" }}>Omsetning og provisjon</div>
        <div className="space-y-1.5">
          {data.fleets.filter((f) => f.trips > 0).length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen flåte-omsetning i perioden</div>
          ) : data.fleets.filter((f) => f.trips > 0).map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(244,244,240,0.04)" }} data-testid={`finance-fleet-${f.id}`}>
              <div className="flex-1 min-w-0 text-[13px] truncate" style={{ color: "var(--text)" }}>{f.name}</div>
              <div className="text-[12px] w-16 text-right" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{f.trips} turer</div>
              <div className="text-[12px] w-24 text-right" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{f.gmv.toLocaleString("no-NO")} kr</div>
              <div className="text-[12px] w-14 text-right" style={{ color: "var(--text-muted)" }}>{Math.round(f.commission_rate * 100)}%</div>
              <div className="text-[12px] w-24 text-right" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{f.commission_amount.toLocaleString("no-NO")} kr</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
