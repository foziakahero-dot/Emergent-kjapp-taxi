import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { LifeBuoy, Plus, Loader2, X, Send } from "lucide-react";

const STATUS_META = {
  open: { label: "Åpen", color: "#d76a5a" },
  in_progress: { label: "Pågår", color: "var(--accent)" },
  waiting_for_user: { label: "Venter på bruker", color: "var(--accent)" },
  resolved: { label: "Løst", color: "#2fe08c" },
  closed: { label: "Lukket", color: "var(--text-muted)" },
};
const PRI_COLOR = { lav: "var(--text-muted)", normal: "var(--text)", "høy": "var(--accent)", kritisk: "#d76a5a" };
const TABS = [{ key: "open", label: "Åpne" }, { key: "resolved", label: "Løst" }, { key: "closed", label: "Lukket" }, { key: "all", label: "Alle" }];

export default function AdminSupport() {
  const [tab, setTab] = useState("open");
  const [tickets, setTickets] = useState(null);
  const [err, setErr] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", category: "annet", priority: "normal", contact_email: "" });
  const [expanded, setExpanded] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await adminApi.tickets(tab); setTickets(r.tickets); setErr(null); }
    catch (e) { setErr(e.response?.data?.detail || "Kunne ikke laste"); }
  };
  useEffect(() => { setTickets(null); load(); /* eslint-disable-next-line */ }, [tab]);

  const create = async () => {
    if (!form.subject.trim()) return;
    setBusy(true);
    try {
      await adminApi.createTicket({ ...form, contact_email: form.contact_email || undefined });
      setShowCreate(false);
      setForm({ subject: "", body: "", category: "annet", priority: "normal", contact_email: "" });
      await load();
    } catch (e) { setErr(e.response?.data?.detail || "Kunne ikke opprette"); }
    finally { setBusy(false); }
  };

  const update = async (id, data) => {
    setBusy(true);
    try { await adminApi.updateTicket(id, data); setNote(""); await load(); }
    catch (e) { setErr(e.response?.data?.detail || "Oppdatering feilet"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="admin-support">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} data-testid={`support-tab-${t.key}`}
              className="px-3 py-1.5 rounded-full text-[12px]"
              style={{
                background: tab === t.key ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
                color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${tab === t.key ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
              }}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} data-testid="support-new-ticket"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px]"
          style={{ background: "rgba(203,163,101,0.14)", color: "var(--accent)", border: "1px solid rgba(203,163,101,0.28)" }}>
          <Plus size={13} /> Ny sak
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(244,244,240,0.04)", border: "1px solid rgba(203,163,101,0.24)" }} data-testid="support-create-form">
          <div className="flex items-center justify-between">
            <div className="font-display text-[16px]" style={{ color: "var(--text)" }}>Registrer ny sak</div>
            <button onClick={() => setShowCreate(false)} data-testid="support-create-close"><X size={16} style={{ color: "var(--text-muted)" }} /></button>
          </div>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Emne *"
            data-testid="support-input-subject" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none bg-transparent"
            style={{ border: "1px solid var(--line)", color: "var(--text)" }} />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Beskrivelse" rows={3}
            data-testid="support-input-body" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none bg-transparent resize-none"
            style={{ border: "1px solid var(--line)", color: "var(--text)" }} />
          <div className="flex gap-2 flex-wrap">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="support-select-category"
              className="px-3 py-2 rounded-xl text-[12px] outline-none" style={{ background: "#0B1013", border: "1px solid var(--line)", color: "var(--text)" }}>
              {["kunde", "sjåfør", "flåte", "betaling", "teknisk", "annet"].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} data-testid="support-select-priority"
              className="px-3 py-2 rounded-xl text-[12px] outline-none" style={{ background: "#0B1013", border: "1px solid var(--line)", color: "var(--text)" }}>
              {["lav", "normal", "høy", "kritisk"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="Kontakt-e-post (valgfri)"
              data-testid="support-input-email" className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-[12px] outline-none bg-transparent"
              style={{ border: "1px solid var(--line)", color: "var(--text)" }} />
          </div>
          <button onClick={create} disabled={busy || !form.subject.trim()} data-testid="support-create-submit"
            className="px-4 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: "var(--accent)", color: "#0B1013", opacity: !form.subject.trim() ? 0.5 : 1 }}>
            {busy ? "Oppretter…" : "Opprett sak"}
          </button>
        </div>
      )}

      {err && <div className="card p-4 text-center text-[13px]" data-testid="support-error">{err}</div>}
      {!tickets ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="support-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>
      ) : tickets.length === 0 ? (
        <div className="card p-8 text-center" data-testid="support-empty">
          <LifeBuoy size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen saker i denne kategorien</div>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const sm = STATUS_META[t.status] || { label: t.status, color: "var(--text-muted)" };
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} className="rounded-2xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid={`ticket-row-${t.id}`}>
                <button onClick={() => setExpanded(isOpen ? null : t.id)} className="w-full flex items-center gap-3 p-4 text-left" data-testid={`ticket-toggle-${t.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "rgba(244,244,240,0.05)", color: sm.color }}>{sm.label}</span>
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: PRI_COLOR[t.priority] || "var(--text-muted)" }}>{t.priority}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {t.category}</span>
                    </div>
                    <div className="text-[14px] truncate" style={{ color: "var(--text)" }}>{t.subject}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {t.contact_email || t.created_by_email} · {new Date(t.created_at).toLocaleString("no-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {(t.notes || []).length > 0 && ` · ${t.notes.length} notat`}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--line)" }} data-testid={`ticket-detail-${t.id}`}>
                    {t.body && <div className="text-[13px] pt-3" style={{ color: "var(--text)" }}>{t.body}</div>}
                    {(t.notes || []).length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        {t.notes.map((n, i) => (
                          <div key={i} className="text-[12px] p-2.5 rounded-xl" style={{ background: "rgba(244,244,240,0.03)", color: "var(--text)" }}>
                            {n.text}
                            <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{n.by} · {new Date(n.at).toLocaleString("no-NO")}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Legg til internt notat…"
                        data-testid={`ticket-note-input-${t.id}`} className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none bg-transparent"
                        style={{ border: "1px solid var(--line)", color: "var(--text)" }} />
                      <button onClick={() => note.trim() && update(t.id, { note })} disabled={busy || !note.trim()} data-testid={`ticket-note-send-${t.id}`}
                        className="px-3 py-2 rounded-xl" style={{ background: "rgba(203,163,101,0.14)", color: "var(--accent)" }}>
                        <Send size={13} />
                      </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(STATUS_META).filter(([k]) => k !== t.status).map(([k, m]) => (
                        <button key={k} onClick={() => update(t.id, { status: k })} disabled={busy} data-testid={`ticket-status-${t.id}-${k}`}
                          className="px-3 py-1.5 rounded-full text-[11px]"
                          style={{ background: "rgba(244,244,240,0.04)", color: m.color, border: "1px solid var(--line)" }}>
                          → {m.label}
                        </button>
                      ))}
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
