import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

const FEATURE_LABEL = {
  surge: "Surge-priser (helg/natt-tillegg)",
  ai_chat: "KJAPP Assist (AI-chat)",
  demo_trips: "Demo-turer (beta)",
  vipps: "Vipps-betaling",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.settings()
      .then(setSettings)
      .catch((e) => setErr(e.response?.data?.detail || "Kunne ikke laste"));
  }, []);

  const save = async () => {
    setSaving(true); setErr(null); setSaved(false);
    try {
      await adminApi.updateSettings({
        default_commission: settings.default_commission,
        ride_classes: settings.ride_classes,
        features: settings.features,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e.response?.data?.detail || "Lagring feilet — krever superadmin");
    } finally { setSaving(false); }
  };

  if (err && !settings) return <div className="card p-6 text-center" data-testid="settings-error">{err}</div>;
  if (!settings) return <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="settings-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>;

  return (
    <div className="space-y-5 max-w-2xl" data-testid="admin-settings">
      {/* Default commission */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="settings-commission">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Økonomi</div>
        <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Standard kommisjon</div>
        <div className="flex items-center gap-3">
          <input
            type="number" min="0" max="50" step="1"
            value={Math.round((settings.default_commission || 0) * 100)}
            onChange={(e) => setSettings({ ...settings, default_commission: Number(e.target.value) / 100 })}
            data-testid="settings-commission-input"
            className="w-24 px-3 py-2.5 rounded-xl text-[15px] outline-none bg-transparent text-center"
            style={{ border: "1px solid var(--line)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
          />
          <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>% av turpris til KJAPP (nye flåter)</span>
        </div>
      </div>

      {/* Ride classes */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="settings-ride-classes">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Produkt</div>
        <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Bil-klasser og prisfaktor</div>
        <div className="space-y-2">
          {Object.entries(settings.ride_classes || {}).map(([key, rc]) => (
            <div key={key} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(244,244,240,0.04)" }} data-testid={`settings-class-${key}`}>
              <button
                onClick={() => setSettings({ ...settings, ride_classes: { ...settings.ride_classes, [key]: { ...rc, enabled: !rc.enabled } } })}
                data-testid={`settings-class-toggle-${key}`}
                className="w-10 h-6 rounded-full relative transition-colors shrink-0"
                style={{ background: rc.enabled ? "var(--accent)" : "rgba(244,244,240,0.08)" }}
              >
                <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: rc.enabled ? 18 : 2, background: "#0B1013" }} />
              </button>
              <div className="flex-1">
                <div className="text-[13px]" style={{ color: rc.enabled ? "var(--text)" : "var(--text-muted)" }}>{rc.label}</div>
                <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{key}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>×</span>
                <input
                  type="number" min="0.5" max="3" step="0.05"
                  value={rc.multiplier}
                  onChange={(e) => setSettings({ ...settings, ride_classes: { ...settings.ride_classes, [key]: { ...rc, multiplier: Number(e.target.value) } } })}
                  data-testid={`settings-class-mult-${key}`}
                  className="w-20 px-2 py-1.5 rounded-lg text-[13px] outline-none bg-transparent text-center"
                  style={{ border: "1px solid var(--line)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature flags */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid="settings-features">
        <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Plattform</div>
        <div className="font-display text-[17px] mb-3" style={{ color: "var(--text)" }}>Funksjoner</div>
        <div className="space-y-2">
          {Object.entries(settings.features || {}).map(([key, on]) => (
            <div key={key} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid rgba(244,244,240,0.04)" }}>
              <span className="text-[13px]" style={{ color: "var(--text)" }}>{FEATURE_LABEL[key] || key}</span>
              <button
                onClick={() => setSettings({ ...settings, features: { ...settings.features, [key]: !on } })}
                data-testid={`settings-feature-${key}`}
                className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: on ? "var(--accent)" : "rgba(244,244,240,0.08)" }}
              >
                <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: on ? 18 : 2, background: "#0B1013" }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {err && <div className="text-[12px] text-center" style={{ color: "#d76a5a" }} data-testid="settings-save-error">{err}</div>}
      <button onClick={save} disabled={saving} data-testid="settings-save"
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-medium"
        style={{ background: saved ? "rgba(47,224,140,0.14)" : "var(--accent)", color: saved ? "#2fe08c" : "#0B1013" }}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
        {saved ? "Lagret" : "Lagre endringer"}
      </button>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {settings.updated_at ? `Sist endret ${new Date(settings.updated_at).toLocaleString("no-NO")}` : "Standardverdier — aldri endret"} · Endringer krever superadmin og logges i revisjonen
      </div>
    </div>
  );
}
