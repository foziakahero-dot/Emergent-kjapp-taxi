import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Search, Users, Loader2, AlertCircle, Star, CheckCircle2, PauseCircle } from "lucide-react";

const TABS = [
  { key: "all", label: "Alle" },
  { key: "approved", label: "Godkjent" },
  { key: "pending", label: "Venter" },
  { key: "online", label: "Online" },
];

export default function AdminDrivers() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [drivers, setDrivers] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const r = await adminApi.driversFull({ status: tab, q: q || undefined });
      setDrivers(r.drivers); setErr(null);
    } catch (e) {
      setErr(e.response?.data?.detail || "Kunne ikke laste");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, q]);

  const setStatus = async (id, approved) => {
    setBusy(id);
    try { await adminApi.setDriverStatus(id, approved); await load(); }
    catch (e) { setErr(e.response?.data?.detail || "Handling feilet"); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4" data-testid="admin-drivers">
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`drivers-tab-${t.key}`}
            className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap"
            style={{
              background: tab === t.key ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
              color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${tab === t.key ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
            }}>{t.label}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}>
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk etter navn, e-post, skilt…"
          data-testid="drivers-search" className="bg-transparent flex-1 text-[13px] outline-none" style={{ color: "var(--text)" }} />
      </div>

      {err && <div className="card p-4 text-center text-[13px]" data-testid="drivers-error"><AlertCircle size={16} className="inline mr-1" style={{ color: "#d76a5a" }} />{err}</div>}
      {!drivers ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="drivers-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>
      ) : drivers.length === 0 ? (
        <div className="card p-8 text-center" data-testid="drivers-empty">
          <Users size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen sjåfører matcher</div>
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((d) => (
            <div key={d.id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid={`driver-row-${d.id}`}>
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-xl grid place-items-center text-[13px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {(d.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                {d.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ background: "#2fe08c", borderColor: "#0B1013" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[15px] truncate" style={{ color: "var(--text)" }}>{d.name}</span>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{
                    background: d.approved ? "rgba(47,224,140,0.12)" : "rgba(203,163,101,0.14)",
                    color: d.approved ? "#2fe08c" : "var(--accent)",
                  }}>{d.approved ? "Godkjent" : "Venter"}</span>
                </div>
                <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  {d.email} · {d.car || "—"} {d.plate || ""}{d.fleet_name ? ` · ${d.fleet_name}` : ""}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4 shrink-0 text-right">
                <div>
                  <div className="flex items-center gap-1 text-[13px]" style={{ color: "var(--text)" }}><Star size={11} style={{ color: "var(--accent)" }} />{d.rating ?? "—"}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>rating</div>
                </div>
                <div>
                  <div className="text-[13px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{d.trips_completed}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>turer</div>
                </div>
              </div>
              {d.approved ? (
                <button onClick={() => setStatus(d.id, false)} disabled={busy === d.id} data-testid={`driver-suspend-${d.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] shrink-0"
                  style={{ background: "rgba(215,106,90,0.10)", color: "#d76a5a", border: "1px solid rgba(215,106,90,0.24)" }}>
                  <PauseCircle size={13} /> Suspender
                </button>
              ) : (
                <button onClick={() => setStatus(d.id, true)} disabled={busy === d.id} data-testid={`driver-approve-${d.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] shrink-0"
                  style={{ background: "rgba(47,224,140,0.10)", color: "#2fe08c", border: "1px solid rgba(47,224,140,0.24)" }}>
                  <CheckCircle2 size={13} /> Godkjenn
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
