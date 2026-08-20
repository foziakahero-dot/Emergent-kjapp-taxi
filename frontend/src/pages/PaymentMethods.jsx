import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paymentApi } from "../lib/api";
import { ChevronLeft, Plus, CreditCard, Trash2, ShieldCheck } from "lucide-react";

const BRAND = {
  vipps: { bg: "linear-gradient(135deg, #ff5b24, #ff8b3d)", text: "Vipps" },
  visa: { bg: "linear-gradient(135deg, #1a1f71, #4a52a5)", text: "VISA" },
  mastercard: { bg: "linear-gradient(135deg, #eb001b, #f79e1b)", text: "Mastercard" },
  amex: { bg: "linear-gradient(135deg, #2e77bc, #4a9fdc)", text: "AMEX" },
};

export default function PaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [busy, setBusy] = useState(false);
  const [vippsEnabled, setVippsEnabled] = useState(false);
  const [banner, setBanner] = useState(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const load = () => paymentApi.list().then(setMethods).catch(() => setMethods([]));

  useEffect(() => {
    load();
    paymentApi.vippsConfig().then((r) => setVippsEnabled(!!r.enabled)).catch(() => {});
  }, []);

  // Handle Stripe redirect after "Add card"
  useEffect(() => {
    const setup = params.get("setup");
    const sid = params.get("session_id");
    if (setup === "success" && sid) {
      setBusy(true);
      paymentApi.cardSetupStatus(sid)
        .then((r) => {
          if (r.ready) {
            setBanner({ type: "ok", text: `Kortet ${r.card?.label} •• ${r.card?.last4} er lagt til.` });
            load();
          } else {
            setBanner({ type: "warn", text: "Kortet er ikke aktivert ennå. Prøv å legg til på nytt." });
          }
        })
        .catch(() => setBanner({ type: "warn", text: "Kunne ikke bekrefte kortet. Prøv igjen." }))
        .finally(() => {
          setBusy(false);
          const p = new URLSearchParams(params);
          p.delete("setup"); p.delete("session_id");
          setParams(p);
        });
    } else if (setup === "cancel") {
      setBanner({ type: "warn", text: "Kort-oppsett ble avbrutt." });
      const p = new URLSearchParams(params);
      p.delete("setup");
      setParams(p);
    }
  }, []);

  const startAddCard = async () => {
    setBusy(true);
    try {
      const r = await paymentApi.cardSetup(window.location.origin);
      if (r.checkout_url) window.location.href = r.checkout_url;
    } catch (e) {
      alert("Kunne ikke starte kort-oppsett. Prøv igjen.");
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Fjern dette kortet?")) return;
    await paymentApi.remove(id);
    load();
  };

  const required = params.get("required") === "1";

  return (
    <div className="px-4 pt-2 pb-10 page-enter">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#7a827a]" data-testid="pay-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Betalingsmetoder</h1>
      </div>

      {required && methods.length === 0 && (
        <div className="mx-2 mb-3 card p-4 border-yellow-500/40 bg-yellow-500/10" data-testid="pay-required-banner">
          <div className="text-yellow-200 text-sm font-medium">Du må legge til et kort før du kan bestille</div>
          <div className="text-yellow-100/70 text-[12px] mt-1">Vi belaster kortet ditt automatisk når turen er ferdig. Ingen forhåndstrekk.</div>
        </div>
      )}

      {banner && (
        <div
          className={`mx-2 mb-3 card p-3 flex items-center gap-2 ${banner.type === "ok" ? "border-mint/40 bg-mint/10" : "border-yellow-500/40 bg-yellow-500/10"}`}
          data-testid="pay-banner"
        >
          <ShieldCheck size={16} className={banner.type === "ok" ? "text-mint" : "text-yellow-400"} />
          <div className="text-sm text-white flex-1">{banner.text}</div>
        </div>
      )}

      <div className="px-2 space-y-3">
        {methods.map((m) => (
          <div
            key={m.id}
            data-testid={`pay-method-${m.type}`}
            className="rounded-2xl p-4 flex items-center gap-4 border border-line shadow-lg"
            style={{ background: BRAND[m.type]?.bg || "linear-gradient(135deg, #17222a, #1e2530)" }}
          >
            <CreditCard className="text-white" size={22} />
            <div className="flex-1">
              <div className="text-white text-sm font-medium">{m.label}</div>
              <div className="text-white/80 text-xs">
                •••• {m.last4}
                {m.exp_month && m.exp_year && ` · ${String(m.exp_month).padStart(2,"0")}/${String(m.exp_year).slice(-2)}`}
              </div>
            </div>
            {m.is_default && (
              <span className="text-[10px] uppercase tracking-widest bg-white/20 text-white px-2 py-1 rounded-full">Standard</span>
            )}
            <button
              onClick={() => remove(m.id)}
              data-testid={`pay-remove-${m.id}`}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/40 grid place-items-center transition-colors"
              aria-label="Fjern"
            >
              <Trash2 size={14} className="text-white" />
            </button>
          </div>
        ))}
        {methods.length === 0 && (
          <div className="card p-6 text-center text-[#7a827a] text-sm">Ingen kort ennå. Legg til under.</div>
        )}
      </div>

      <button
        onClick={startAddCard}
        disabled={busy}
        data-testid="pay-add-card"
        className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border border-dashed border-line text-mint hover:border-mint transition-colors"
      >
        <Plus size={18} /> {busy ? "Åpner sikker betaling…" : "Legg til betalingskort"}
      </button>

      {/* Vipps section */}
      <div className="mt-6">
        <div className="text-[10px] text-[#7a827a] uppercase tracking-widest px-2 mb-2">Norsk betaling</div>
        {vippsEnabled ? (
          <button
            data-testid="pay-add-vipps"
            className="w-full rounded-2xl p-4 flex items-center gap-4 border border-line"
            style={{ background: BRAND.vipps.bg }}
          >
            <div className="text-white text-sm font-medium flex-1 text-left">Koble til Vipps</div>
            <span className="text-white/90 text-xs">Legg til</span>
          </button>
        ) : (
          <div
            data-testid="pay-vipps-coming"
            className="w-full rounded-2xl p-4 flex items-center gap-4 border border-line opacity-70"
            style={{ background: BRAND.vipps.bg }}
          >
            <div className="text-white text-sm font-medium flex-1 text-left">Vipps</div>
            <span className="text-white text-[10px] uppercase tracking-widest bg-white/25 px-2 py-1 rounded-full">Kommer snart</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 text-[11px] text-[#7a827a] px-2">
        <ShieldCheck size={14} className="text-mint" />
        <span>Kortet lagres sikkert hos Stripe. Vi belaster kun etter fullført tur.</span>
      </div>
    </div>
  );
}
