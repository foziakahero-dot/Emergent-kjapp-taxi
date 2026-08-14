import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { paymentApi } from "../lib/api";
import { ChevronLeft, Plus, CreditCard } from "lucide-react";

const BRAND = {
  vipps: { bg: "linear-gradient(135deg, #ff5b24, #ff8b3d)", text: "Vipps" },
  visa: { bg: "linear-gradient(135deg, #1a1f71, #4a52a5)", text: "VISA" },
  mastercard: { bg: "linear-gradient(135deg, #eb001b, #f79e1b)", text: "Mastercard" },
};

export default function PaymentMethods() {
  const [methods, setMethods] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newCard, setNewCard] = useState({ type: "visa", label: "Visa", last4: "" });
  const navigate = useNavigate();

  const load = () => paymentApi.list().then(setMethods);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (newCard.last4.length !== 4) return;
    await paymentApi.add({ ...newCard, is_default: false });
    setAdding(false);
    setNewCard({ type: "visa", label: "Visa", last4: "" });
    load();
  };

  return (
    <div className="px-4 pt-2 pb-10 page-enter">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#8a94a8]" data-testid="pay-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Betalingsmetoder</h1>
      </div>

      <div className="px-2 space-y-3">
        {methods.map((m) => (
          <div
            key={m.id}
            data-testid={`pay-method-${m.type}`}
            className="rounded-2xl p-4 flex items-center gap-4 border border-line"
            style={{ background: BRAND[m.type]?.bg || "#111a2b" }}
          >
            <CreditCard className="text-white" size={22} />
            <div className="flex-1">
              <div className="text-white text-sm font-medium">{m.label}</div>
              <div className="text-white/80 text-xs">•••• {m.last4}</div>
            </div>
            {m.is_default && (
              <span className="text-[10px] uppercase tracking-widest bg-white/20 text-white px-2 py-1 rounded-full">Standard</span>
            )}
          </div>
        ))}
      </div>

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          data-testid="pay-add"
          className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border border-dashed border-line text-mint hover:border-mint transition-colors"
        >
          <Plus size={18} /> Legg til kort
        </button>
      ) : (
        <div className="mt-5 card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {["visa", "mastercard", "vipps"].map((t) => (
              <button
                key={t}
                onClick={() => setNewCard({ ...newCard, type: t, label: t === "vipps" ? "Vipps" : t === "visa" ? "Visa" : "Mastercard" })}
                data-testid={`newcard-type-${t}`}
                className={`py-2 rounded-lg border ${newCard.type === t ? "border-mint bg-mint/10" : "border-line bg-[#17223a]"} text-white text-sm capitalize`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="Siste 4 sifre"
            maxLength={4}
            value={newCard.last4}
            onChange={(e) => setNewCard({ ...newCard, last4: e.target.value.replace(/\D/g, "") })}
            data-testid="newcard-last4"
          />
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setAdding(false)} data-testid="newcard-cancel">Avbryt</button>
            <button className="btn-primary flex-1" onClick={add} data-testid="newcard-save">Lagre</button>
          </div>
        </div>
      )}
    </div>
  );
}
