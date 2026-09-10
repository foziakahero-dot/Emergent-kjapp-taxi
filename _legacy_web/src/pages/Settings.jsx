import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { settingsApi, gdprApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, Mic, Download, Trash2, CreditCard } from "lucide-react";

const TOGGLES = [
  { key: "notifications", label: "Varslinger" },
  { key: "trip_updates", label: "Reiseoppdateringer" },
  { key: "auto_booking", label: "Automatisk bestilling" },
  { key: "price_alerts", label: "Prisvarsel" },
];

const ROWS = [
  { key: "language", label: "Språk", options: ["Norsk", "English"] },
  { key: "theme", label: "Tema", options: ["Mørk", "Lys"] },
];

export default function Settings() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    settingsApi.get().then(setS);
  }, []);

  const update = async (k, v) => {
    setS({ ...s, [k]: v });
    await settingsApi.update({ [k]: v });
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await gdprApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kjapp-data-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Kunne ikke eksportere data.");
    } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Er du sikker på at du vil slette kontoen din permanent?\n\nDette kan ikke angres. Personlige data slettes umiddelbart, men turer beholdes anonymisert av regnskapsmessige årsaker (norsk lov).")) return;
    setBusy(true);
    try {
      await gdprApi.delete();
      await logout();
      navigate("/", { replace: true });
    } catch (e) {
      alert("Kunne ikke slette kontoen. Kontakt support@kjapp.no.");
      setBusy(false);
    }
  };

  if (!s) return <div className="min-h-[40vh] grid place-items-center"><div className="orb orb-tiny" /></div>;

  return (
    <div className="px-4 pt-2 pb-10 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#7a827a]" data-testid="settings-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">AI Innstillinger</h1>
      </div>

      <div className="px-2 space-y-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
              <Mic size={16} className="text-mint" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] text-[#7a827a]">AI-stemme</div>
              <div className="text-white text-sm mt-0.5">{s.ai_voice}</div>
            </div>
            <select
              value={s.ai_voice}
              onChange={(e) => update("ai_voice", e.target.value)}
              data-testid="setting-voice"
              className="bg-[#17222a] border border-line text-white text-xs rounded-lg px-2 py-1"
            >
              {["Nora (Standard)", "Emma", "Henrik", "Sofie"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card divide-y divide-line">
          {TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex items-center px-4 py-3.5 cursor-pointer">
              <span className="flex-1 text-white text-sm">{label}</span>
              <Toggle checked={!!s[key]} onChange={(v) => update(key, v)} testid={`toggle-${key}`} />
            </label>
          ))}
        </div>

        <div className="card divide-y divide-line">
          {ROWS.map(({ key, label, options }) => (
            <div key={key} className="flex items-center px-4 py-3.5">
              <span className="flex-1 text-white text-sm">{label}</span>
              <select
                value={s[key]}
                onChange={(e) => update(key, e.target.value)}
                data-testid={`setting-${key}`}
                className="bg-transparent text-mint text-sm text-right pr-1"
              >
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronRight size={14} className="text-[#7a827a] ml-1" />
            </div>
          ))}
        </div>

        {/* Betaling & kort */}
        <div className="pt-2">
          <div className="text-[10px] text-[#5f6862] tracking-widest uppercase px-2 mb-2">Betaling</div>
          <div className="card divide-y divide-line">
            <button
              onClick={() => navigate("/app/payment-methods")}
              data-testid="settings-payment-methods"
              className="w-full flex items-center px-4 py-3.5 hover:bg-[#17222a] transition-colors"
            >
              <div className="w-9 h-9 rounded-full grid place-items-center mr-3" style={{ background: "rgba(201,161,91,0.14)" }}>
                <CreditCard size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white text-sm">Bankkort og betaling</div>
                <div className="text-[11px] text-[#7a827a] mt-0.5">Legg til, verifiser og administrer kort</div>
              </div>
              <ChevronRight size={14} className="text-[#7a827a]" />
            </button>
          </div>
        </div>

        {/* GDPR */}
        <div className="pt-2">
          <div className="text-[10px] text-[#5f6862] tracking-widest uppercase px-2 mb-2">Personvern (GDPR)</div>
          <div className="card divide-y divide-line">
            <button
              onClick={exportData}
              disabled={busy}
              data-testid="gdpr-export"
              className="w-full flex items-center px-4 py-3.5 hover:bg-[#17222a] transition-colors"
            >
              <Download size={16} className="text-mint mr-3" />
              <span className="flex-1 text-left text-white text-sm">Eksporter mine data</span>
              <ChevronRight size={14} className="text-[#7a827a]" />
            </button>
            <button
              onClick={deleteAccount}
              disabled={busy}
              data-testid="gdpr-delete"
              className="w-full flex items-center px-4 py-3.5 hover:bg-[#17222a] transition-colors"
            >
              <Trash2 size={16} className="text-red-400 mr-3" />
              <span className="flex-1 text-left text-red-400 text-sm">Slett kontoen min</span>
              <ChevronRight size={14} className="text-[#7a827a]" />
            </button>
          </div>
          <p className="text-[11px] text-[#5f6862] px-2 mt-2 leading-relaxed">
            Turer beholdes anonymisert i henhold til norsk bokføringslov. Alt annet slettes umiddelbart.
          </p>
        </div>

        <div className="text-center pt-2">
          <div className="text-[10px] text-[#5f6862] tracking-widest uppercase">Versjon 2.0.0</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, testid }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-mint" : "bg-[#263038]"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}
