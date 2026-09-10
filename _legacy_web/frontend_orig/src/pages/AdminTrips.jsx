import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Search, Route as RouteIcon, Loader2, ChevronDown, ChevronUp, Star } from "lucide-react";

const TABS = [
  { key: "all", label: "Alle" },
  { key: "active", label: "Aktive" },
  { key: "completed", label: "Fullført" },
  { key: "cancelled", label: "Kansellert" },
];

const STATUS_META = {
  searching: { label: "Søker", tone: "accent" }, booking: { label: "Booket", tone: "accent" },
  driver_on_way: { label: "På vei", tone: "accent" }, at_pickup: { label: "Venter", tone: "accent" },
  in_trip: { label: "Pågår", tone: "accent" }, arrived: { label: "Fullført", tone: "ok" },
  completed: { label: "Fullført", tone: "ok" }, rated: { label: "Vurdert", tone: "ok" },
  cancelled: { label: "Kansellert", tone: "warn" }, cancelled_by_driver: { label: "Kansellert (sjåfør)", tone: "warn" },
};

export default function AdminTrips() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [trips, setTrips] = useState(null);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    let alive = true;
    adminApi.tripsFull({ status: tab, q: q || undefined, limit: 100 })
      .then((r) => { if (alive) { setTrips(r.trips); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); });
    return () => { alive = false; };
  }, [tab, q]);

  const toggle = async (tripId) => {
    if (expanded === tripId) { setExpanded(null); setTimeline(null); return; }
    setExpanded(tripId); setTimeline(null);
    try { setTimeline(await adminApi.tripTimeline(tripId)); } catch { setTimeline({ events: [] }); }
  };

  return (
    <div className="space-y-4" data-testid="admin-trips">
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`trips-tab-${t.key}`}
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk etter adresse eller tur-ID…"
          data-testid="trips-search" className="bg-transparent flex-1 text-[13px] outline-none" style={{ color: "var(--text)" }} />
      </div>

      {err && <div className="card p-4 text-center text-[13px]" data-testid="trips-error">{err}</div>}
      {!trips ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="trips-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>
      ) : trips.length === 0 ? (
        <div className="card p-8 text-center" data-testid="trips-empty">
          <RouteIcon size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen turer matcher</div>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((t) => {
            const meta = STATUS_META[t.status] || { label: t.status, tone: "muted" };
            const toneColor = meta.tone === "ok" ? "#2fe08c" : meta.tone === "warn" ? "#d76a5a" : "var(--accent)";
            const isOpen = expanded === t.trip_id;
            return (
              <div key={t.trip_id} className="rounded-2xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid={`trip-row-${t.trip_id}`}>
                <button onClick={() => toggle(t.trip_id)} className="w-full flex items-center gap-4 p-4 text-left" data-testid={`trip-toggle-${t.trip_id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${meta.tone === "ok" ? "rgba(47,224,140,0.12)" : meta.tone === "warn" ? "rgba(215,106,90,0.14)" : "rgba(203,163,101,0.14)"}`, color: toneColor }}>{meta.label}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.created_at ? new Date(t.created_at).toLocaleString("no-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      {t.passenger_rating && <span className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--accent)" }}><Star size={10} />{t.passenger_rating}</span>}
                    </div>
                    <div className="text-[13px] truncate" style={{ color: "var(--text)" }}>{t.pickup_address} → {t.dropoff_address}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {t.passenger_name || "Kunde"}{t.driver_name ? ` · Sjåfør: ${t.driver_name}` : " · Ingen sjåfør"}
                      {t.driver_plate ? ` · ${t.driver_car || "Bil"} (${t.driver_plate})` : ""}
                      {t.distance_km ? ` · ${t.distance_km} km` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-[16px]" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{t.price ?? "—"} kr</div>
                    {t.driver_earnings != null && (
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--accent)" }} data-testid={`trip-earnings-${t.trip_id}`}>
                        {t.driver_earnings} kr til flåten
                      </div>
                    )}
                    {t.payment_status && (
                      <div className="text-[10px] mt-0.5" style={{ color: t.payment_status === "paid" ? "#2fe08c" : "var(--text-muted)" }} data-testid={`trip-payment-${t.trip_id}`}>
                        {t.payment_status === "paid" ? "Betalt" : "Ubetalt"}
                      </div>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4" data-testid={`trip-timeline-${t.trip_id}`}>
                    <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--line)" }}>
                      {!timeline ? (
                        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}><Loader2 size={13} className="animate-spin" /> Laster tidslinje…</div>
                      ) : timeline.events.length === 0 ? (
                        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen hendelser registrert</div>
                      ) : timeline.events.map((e, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                          <span className="text-[12px] flex-1" style={{ color: "var(--text)" }}>{e.label}</span>
                          <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{new Date(e.at).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        </div>
                      ))}
                      <div className="text-[10px] font-mono pt-1" style={{ color: "var(--text-muted)" }}>ID: {t.trip_id}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
