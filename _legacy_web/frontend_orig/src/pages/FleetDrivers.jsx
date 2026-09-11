import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi, fleetInviteApi, formatApiErrorDetail } from "../lib/api";
import { ChevronLeft, Search, UserPlus, Mail, Car, X, Copy, CheckCircle2, Send } from "lucide-react";

export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("drivers");
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState("");
  const navigate = useNavigate();

  const load = () => {
    fleetApi.drivers().then((r) => setDrivers(r.drivers || [])).catch(() => {});
    fleetInviteApi.list().then((r) => setInvites(r.invites || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filtered = drivers.filter((d) =>
    (d.fullName || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.plate || "").toLowerCase().includes(q.toLowerCase()) ||
    (d.car || "").toLowerCase().includes(q.toLowerCase())
  );

  const inviteLink = (t) => `${window.location.origin}/driver-signup/${t}`;

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="fleet-drivers-page">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 grid place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="fleet-drivers-back">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white flex-1">Sjåfører</h1>
        <button
          onClick={() => setShowInvite(true)}
          data-testid="fleet-invite-open"
          className="px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-colors"
          style={{ background: "rgba(47,224,140,0.14)", border: "1px solid rgba(47,224,140,0.35)", color: "#2fe08c" }}
        >
          <UserPlus size={14} /> Inviter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3">
        <TabBtn active={tab === "drivers"} onClick={() => setTab("drivers")} label={`Aktive · ${drivers.length}`} testid="tab-drivers" />
        <TabBtn active={tab === "invites"} onClick={() => setTab("invites")} label={`Invitasjoner · ${invites.length}`} testid="tab-invites" />
      </div>

      {tab === "drivers" ? (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk navn, skilt eller bil"
              className="input pl-10"
              data-testid="fleet-search"
            />
          </div>
          <div className="space-y-2">
            {filtered.map((d) => (
              <div key={d.id} className="card p-4 flex items-center gap-3" data-testid={`driver-row-${d.id}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${d.online ? "bg-mint animate-pulse" : ""}`} style={!d.online ? { background: "rgba(255,255,255,0.15)" } : undefined} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm">{d.fullName}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{d.plate} · {d.car} · {(d.rating || 5).toFixed(1)} ★</div>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm">{d.today_income} kr</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{d.today_trips || 0} turer</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>Ingen sjåfører matcher søket</div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {invites.length === 0 && (
            <div className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>Ingen invitasjoner enda. Klikk «Inviter» for å sende første.</div>
          )}
          {invites.map((i) => (
            <div key={i.token} className="card p-4" data-testid={`invite-row-${i.token.substr(0,8)}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: i.used ? "rgba(47,224,140,0.12)" : "rgba(255,255,255,0.05)" }}>
                  {i.used ? <CheckCircle2 size={16} className="text-mint" /> : <Mail size={16} style={{ color: "var(--text-muted)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{i.email || <span style={{ color: "var(--text-muted)" }}>ingen e-post</span>}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{i.car} · {i.plate}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full inline-block" style={{ background: i.used ? "rgba(47,224,140,0.14)" : "rgba(255,255,255,0.06)", color: i.used ? "#2fe08c" : "var(--text-muted)" }}>
                    {i.used ? "Godtatt" : (i.email_sent ? "Sendt" : "Venter")}
                  </div>
                </div>
              </div>
              {!i.used && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteLink(i.token));
                    setCopied(i.token); setTimeout(() => setCopied(""), 1500);
                  }}
                  className="w-full mt-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                  style={{ background: "rgba(47,224,140,0.10)", border: "1px solid rgba(47,224,140,0.30)", color: "#2fe08c" }}
                  data-testid={`invite-copy-${i.token.substr(0,8)}`}
                >
                  {copied === i.token ? <><CheckCircle2 size={14} /> Kopiert!</> : <><Copy size={14} /> Kopier invitasjonslenke</>}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); setTab("invites"); load(); }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="px-4 py-2 rounded-full text-[13px] transition-colors"
      style={{
        background: active ? "rgba(47,224,140,0.14)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(47,224,140,0.32)" : "rgba(255,255,255,0.06)"}`,
        color: active ? "#2fe08c" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

function InviteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ car: "", plate: "", vehicle_type: "ai-first", note: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setErr("");
    if (!form.car || !form.plate) { setErr("Bil og skilt må fylles ut"); return; }
    setSaving(true);
    try { await fleetInviteApi.create(form); onCreated(); }
    catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke opprette invitasjon"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[1100] grid place-items-end sm:place-items-center px-4 pb-8" style={{ background: "rgba(4,8,10,0.72)", backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div className="w-full max-w-[420px] p-5 rounded-3xl" style={{ background: "rgba(14,20,26,0.98)", border: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: "rgba(47,224,140,0.14)" }}>
            <UserPlus size={20} className="text-mint" />
          </div>
          <div className="flex-1">
            <div className="font-display text-[20px] text-white">Inviter sjåfør</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Send en lenke — sjåføren registrerer seg selv</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }} data-testid="invite-close"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <Field label="Bilmodell" value={form.car} onChange={(v) => update("car", v)} placeholder="Tesla Model 3, Toyota Camry …" testid="invite-car" />
          <Field label="Skiltnummer" value={form.plate} onChange={(v) => update("plate", v.toUpperCase())} placeholder="AB 12345" testid="invite-plate" />
          <div>
            <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>Bilkategori</label>
            <select value={form.vehicle_type} onChange={(e) => update("vehicle_type", e.target.value)} className="input mt-1" data-testid="invite-type">
              <option value="ai-first">Standard</option>
              <option value="enkelt">Sparsom</option>
              <option value="trygg">Komfort</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <Field label="E-post (valgfri)" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="sjafor@navn.no" testid="invite-email" />
          <div>
            <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>Notat (valgfri)</label>
            <textarea value={form.note} onChange={(e) => update("note", e.target.value)} rows={2} className="input mt-1" placeholder="Kort velkomstmelding …" data-testid="invite-note" />
          </div>
          {err && <div className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.30)", color: "#e8c9b0" }}>{err}</div>}
        </div>

        <button onClick={submit} disabled={saving} className="btn-primary w-full mt-5 flex items-center justify-center gap-2" data-testid="invite-submit">
          {saving ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-on)", borderTopColor: "transparent" }} /> : <><Send size={16} /> Send invitasjon</>}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, testid }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input mt-1" data-testid={testid} />
    </div>
  );
}
