import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Plus, Trash2, Power, Loader2 } from "lucide-react";
import { adminApi } from "../lib/api";
import { toast } from "sonner";

const EMPTY = { name: "", trips_required: 5, bonus_kr: 200, start_hour: 15, end_hour: 19, max_per_driver_per_day: 1 };

export default function AdminBonus() {
  const [campaigns, setCampaigns] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [c, p] = await Promise.all([
      adminApi.bonusCampaigns().catch(() => ({ campaigns: [] })),
      adminApi.bonusPayouts().catch(() => ({ payouts: [], total_kr: 0 })),
    ]);
    setCampaigns(c.campaigns || []);
    setPayouts(p);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Gi oppdraget et navn");
    setSaving(true);
    try {
      await adminApi.createBonusCampaign({
        name: form.name.trim(),
        trips_required: Number(form.trips_required),
        bonus_kr: Number(form.bonus_kr),
        start_hour: Number(form.start_hour),
        end_hour: Number(form.end_hour),
        max_per_driver_per_day: Number(form.max_per_driver_per_day),
        active: true,
      });
      toast.success("Oppdrag opprettet");
      setForm(EMPTY);
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Kunne ikke lagre");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    await adminApi.updateBonusCampaign(c.id, { active: !c.active }).catch(() => toast.error("Kunne ikke oppdatere"));
    await load();
  };

  const remove = async (c) => {
    await adminApi.deleteBonusCampaign(c.id).catch(() => toast.error("Kunne ikke slette"));
    await load();
  };

  return (
    <div data-testid="admin-bonus">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>Sjåførbonus</div>
          <h1 className="font-display text-2xl mt-1" style={{ color: "var(--text)" }}>Oppdrag i travle timer</h1>
          <p className="text-[13px] mt-1 max-w-xl" style={{ color: "var(--text-muted)" }}>
            «Fullfør X turer mellom to klokkeslett → +Y kr». Bonusen dekkes av KJAPPs egen provisjon —
            kundens pris endres ikke. Sjåføren ser oppdraget og fremdriften i varmekartet.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} data-testid="bonus-new-btn" className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={16} /> Nytt oppdrag
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-5 mb-6" data-testid="bonus-form">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <Field label="Navn" className="col-span-2">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Rushtid ettermiddag"
                    data-testid="bonus-name"
                    className="input-field w-full"
                  />
                </Field>
                <Field label="Turer">
                  <input type="number" min="1" max="50" value={form.trips_required} data-testid="bonus-trips"
                    onChange={(e) => setForm({ ...form, trips_required: e.target.value })} className="input-field w-full" />
                </Field>
                <Field label="Bonus (kr)">
                  <input type="number" min="1" max="5000" value={form.bonus_kr} data-testid="bonus-amount"
                    onChange={(e) => setForm({ ...form, bonus_kr: e.target.value })} className="input-field w-full" />
                </Field>
                <Field label="Fra (kl)">
                  <input type="number" min="0" max="23" value={form.start_hour} data-testid="bonus-start"
                    onChange={(e) => setForm({ ...form, start_hour: e.target.value })} className="input-field w-full" />
                </Field>
                <Field label="Til (kl)">
                  <input type="number" min="1" max="24" value={form.end_hour} data-testid="bonus-end"
                    onChange={(e) => setForm({ ...form, end_hour: e.target.value })} className="input-field w-full" />
                </Field>
                <Field label="Maks per sjåfør/dag">
                  <input type="number" min="1" max="10" value={form.max_per_driver_per_day} data-testid="bonus-cap"
                    onChange={(e) => setForm({ ...form, max_per_driver_per_day: e.target.value })} className="input-field w-full" />
                </Field>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={save} disabled={saving} data-testid="bonus-save" className="btn-primary flex items-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />} Opprett oppdrag
                </button>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Maks kostnad: {Number(form.bonus_kr) * Number(form.max_per_driver_per_day)} kr per sjåfør per dag
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {campaigns === null ? (
            <div className="card p-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Laster…</div>
          ) : campaigns.length === 0 ? (
            <div className="card p-8 text-center" data-testid="bonus-empty">
              <Gift size={22} style={{ color: "var(--accent)" }} className="mx-auto mb-2" />
              <div className="font-display text-lg" style={{ color: "var(--text)" }}>Ingen oppdrag ennå</div>
              <div className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                Opprett ett oppdrag, og alle sjåfører ser det umiddelbart i appen.
              </div>
            </div>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="card p-4 flex items-center gap-4" data-testid={`bonus-row-${c.id}`}>
                <div
                  className="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
                  style={{ background: c.active ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.06)", border: "1px solid rgba(203,163,101,0.28)" }}
                >
                  <Gift size={18} style={{ color: c.active ? "var(--accent)" : "var(--text-muted)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate" style={{ color: "var(--text)" }}>{c.name}</span>
                    <span
                      className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ color: c.active ? "#2FE08C" : "var(--text-muted)", background: c.active ? "rgba(47,224,140,0.12)" : "rgba(244,244,240,0.06)" }}
                    >
                      {c.active ? "Aktiv" : "Av"}
                    </span>
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {c.trips_required} turer mellom kl {String(c.start_hour).padStart(2, "0")}–{String(c.end_hour).padStart(2, "0")}
                    {" · "}maks {c.max_per_driver_per_day}× per sjåfør/dag
                    {c.payouts_count > 0 && ` · utbetalt ${c.payouts_count}× (${c.spent_kr} kr)`}
                  </div>
                </div>
                <div className="font-display text-lg shrink-0" style={{ color: "var(--accent)" }}>+{c.bonus_kr} kr</div>
                <button onClick={() => toggle(c)} data-testid={`bonus-toggle-${c.id}`} className="p-2 rounded-xl" title={c.active ? "Skru av" : "Skru på"}>
                  <Power size={16} style={{ color: c.active ? "#2FE08C" : "var(--text-muted)" }} />
                </button>
                <button onClick={() => remove(c)} data-testid={`bonus-delete-${c.id}`} className="p-2 rounded-xl" title="Slett">
                  <Trash2 size={16} style={{ color: "#e08a7a" }} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="card p-5" data-testid="bonus-payouts">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--accent)" }}>Utbetalt bonus</div>
            <div className="font-display text-lg" style={{ color: "var(--text)" }}>{payouts?.total_kr ?? 0} kr</div>
          </div>
          {!payouts?.payouts?.length ? (
            <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>Ingen bonus utbetalt ennå.</div>
          ) : (
            <div className="space-y-2.5">
              {payouts.payouts.slice(0, 12).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] truncate" style={{ color: "var(--text)" }}>{p.driver_name || "Sjåfør"}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {p.campaign_name} · {p.local_date}
                    </div>
                  </div>
                  <div className="font-display text-[15px] shrink-0" style={{ color: "var(--accent)" }}>+{p.amount} kr</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: "var(--text-muted)" }}>{label}</span>
    {children}
  </label>
);
