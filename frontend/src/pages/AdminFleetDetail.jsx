import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "../lib/api";
import { ArrowLeft, Building2, Loader2, PauseCircle, PlayCircle, Save, Star } from "lucide-react";

export default function AdminFleetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [commission, setCommission] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await adminApi.fleetDetail(id);
      setData(r); setErr(null);
      setCommission(String(Math.round((r.fleet.commission_rate || 0.10) * 100)));
    } catch (e) { setErr(e.response?.data?.detail || "Kunne ikke laste"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); setReason(""); await load(); }
    catch (e) { setErr(e.response?.data?.detail || "Handling feilet"); }
    finally { setBusy(false); }
  };

  if (err && !data) return <div className="card p-6 text-center" data-testid="fleet-detail-error">{err}</div>;
  if (!data) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="fleet-detail-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>;

  const f = data.fleet;
  const suspended = f.status === "suspended";

  return (
    <div className="space-y-5" data-testid="admin-fleet-detail">
      <button onClick={() => navigate("/admin/fleets")} data-testid="fleet-detail-back"
        className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
        <ArrowLeft size={13} /> Tilbake til flåter
      </button>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl grid place-items-center shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Building2 size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-[24px]" style={{ color: "var(--text)" }} data-testid="fleet-detail-name">{f.name}</h2>
            <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{
              background: suspended ? "rgba(215,106,90,0.14)" : "rgba(47,224,140,0.12)",
              color: suspended ? "#d76a5a" : "#2fe08c",
            }} data-testid="fleet-detail-status">{suspended ? "Suspendert" : "Aktiv"}</span>
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
            Org.nr {f.org_number || "—"} · {f.contact_email || "—"} · {data.drivers.length} sjåfører
          </div>
        </div>
        {suspended ? (
          <button onClick={() => act(() => adminApi.reactivateFleet(id))} disabled={busy} data-testid="fleet-detail-reactivate"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px]"
            style={{ background: "rgba(47,224,140,0.10)", color: "#2fe08c", border: "1px solid rgba(47,224,140,0.24)" }}>
            <PlayCircle size={14} /> Reaktiver
          </button>
        ) : (
          <button onClick={() => act(() => adminApi.suspendFleet(id, reason || undefined))} disabled={busy} data-testid="fleet-detail-suspend"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px]"
            style={{ background: "rgba(215,106,90,0.10)", color: "#d76a5a", border: "1px solid rgba(215,106,90,0.24)" }}>
            <PauseCircle size={14} /> Suspender
          </button>
        )}
      </div>

      {err && <div className="text-[12px]" style={{ color: "#d76a5a" }} data-testid="fleet-detail-action-error">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Commission */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="fleet-detail-commission">
          <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Økonomi</div>
          <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Kommisjon</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="number" min="0" max="50" value={commission} onChange={(e) => setCommission(e.target.value)}
              data-testid="fleet-commission-input"
              className="w-20 px-3 py-2.5 rounded-xl text-[15px] outline-none bg-transparent text-center"
              style={{ border: "1px solid var(--line)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }} />
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>%</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Årsak (valgfri)"
              data-testid="fleet-commission-reason"
              className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl text-[12px] outline-none bg-transparent"
              style={{ border: "1px solid var(--line)", color: "var(--text)" }} />
            <button onClick={() => act(() => adminApi.updateCommission(id, Number(commission) / 100, reason || undefined))} disabled={busy}
              data-testid="fleet-commission-save"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px]"
              style={{ background: "var(--accent)", color: "#0B1013" }}>
              <Save size={13} /> Lagre
            </button>
          </div>
          {data.commission_history.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Historikk</div>
              {data.commission_history.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span style={{ color: "var(--text)" }}>{Math.round(c.commission_rate * 100)}%{c.reason ? ` — ${c.reason}` : ""}</span>
                  <span className="font-mono" style={{ color: "var(--text-muted)" }}>{new Date(c.effective_from).toLocaleDateString("no-NO")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drivers */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="fleet-detail-drivers">
          <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Team</div>
          <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Sjåfører ({data.drivers.length})</div>
          {data.drivers.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen sjåfører tilknyttet</div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {data.drivers.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: "rgba(244,244,240,0.02)" }} data-testid={`fleet-driver-${d.id}`}>
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg grid place-items-center text-[11px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {(d.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    {d.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border" style={{ background: "#2fe08c", borderColor: "#0B1013" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] truncate" style={{ color: "var(--text)" }}>{d.name}</div>
                    <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{d.car || "—"} {d.plate || ""}</div>
                  </div>
                  {d.rating && <span className="flex items-center gap-0.5 text-[11px] shrink-0" style={{ color: "var(--accent)" }}><Star size={10} />{d.rating}</span>}
                  <span className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: d.approved ? "#2fe08c" : "var(--accent)" }}>{d.approved ? "OK" : "Venter"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="fleet-detail-audit">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Revisjon</div>
        <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Hendelser for denne flåten</div>
        {data.audit.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Ingen hendelser registrert</div>
        ) : (
          <div className="space-y-2">
            {data.audit.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                <span className="flex-1" style={{ color: "var(--text)" }}>{e.action}{e.reason ? ` — ${e.reason}` : ""}</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{e.admin_email} · {new Date(e.at).toLocaleString("no-NO")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
