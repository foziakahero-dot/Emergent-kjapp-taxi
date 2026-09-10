import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { ClipboardList, Loader2, AlertCircle, Building2, User as UserIcon } from "lucide-react";

const ACTION_LABEL = {
  "fleet.suspend":         { label: "Flåte suspendert", tone: "warn" },
  "fleet.reactivate":      { label: "Flåte reaktivert", tone: "ok" },
  "fleet.commission_change": { label: "Kommisjon endret", tone: "accent" },
  "fleet.approve":         { label: "Flåte godkjent",   tone: "ok" },
  "fleet.reject":          { label: "Flåte avvist",     tone: "warn" },
  "driver.approve":        { label: "Sjåfør godkjent",  tone: "ok" },
  "driver.suspend":        { label: "Sjåfør suspendert",tone: "warn" },
};

export default function AdminAudit() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.auditLog(filter || undefined)
      .then((r) => { if (alive) setEvents(r.events || []); })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter]);

  return (
    <div className="space-y-4" data-testid="admin-audit">
      <div className="flex gap-2 items-center flex-wrap">
        {["", "fleet", "driver", "trip", "payout"].map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            data-testid={`audit-filter-${f || "all"}`}
            className="px-3 py-1.5 rounded-full text-[12px]"
            style={{
              background: filter === f ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
              color: filter === f ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${filter === f ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
            }}
          >
            {f ? f.charAt(0).toUpperCase() + f.slice(1) : "Alle"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="audit-loading">
          <Loader2 size={16} className="animate-spin" /> Laster hendelser…
        </div>
      ) : err ? (
        <div className="card p-6 text-center" data-testid="audit-error"><AlertCircle size={20} className="mx-auto mb-2" style={{ color: "#d76a5a" }} /><div>{err}</div></div>
      ) : events.length === 0 ? (
        <div className="card p-8 text-center" data-testid="audit-empty">
          <ClipboardList size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen revisjons-hendelser ennå</div>
          <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Suspender en flåte eller endre kommisjon for å se hendelsene her</div>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => {
            const meta = ACTION_LABEL[e.action] || { label: e.action, tone: "muted" };
            const toneColor = meta.tone === "ok" ? "#2fe08c" : meta.tone === "warn" ? "#d76a5a" : meta.tone === "accent" ? "var(--accent)" : "var(--text-muted)";
            return (
              <div
                key={e.id}
                data-testid={`audit-event-${e.id}`}
                className="p-4 rounded-2xl"
                style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(203,163,101,0.08)", color: toneColor }}>
                    {e.entity_type === "fleet" ? <Building2 size={15} /> : <UserIcon size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium" style={{ color: toneColor }}>{meta.label}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {e.entity_type} {e.entity_id?.slice(-6)}</span>
                    </div>
                    {e.reason && <div className="text-[12px] mt-0.5" style={{ color: "var(--text)" }}>{e.reason}</div>}
                    {(e.before || e.after) && (
                      <div className="text-[11px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>
                        {e.before && <>før: {JSON.stringify(e.before)} </>}
                        {e.after && <>→ etter: {JSON.stringify(e.after)}</>}
                      </div>
                    )}
                    <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {e.admin_email || "admin"} · {new Date(e.at).toLocaleString("no-NO")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
