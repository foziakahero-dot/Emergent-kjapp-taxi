import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { settingsApi } from "../lib/api";
import { ChevronLeft, ChevronRight, Mic } from "lucide-react";

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
  const navigate = useNavigate();

  useEffect(() => {
    settingsApi.get().then(setS);
  }, []);

  const update = async (k, v) => {
    setS({ ...s, [k]: v });
    await settingsApi.update({ [k]: v });
  };

  if (!s) return <div className="min-h-[40vh] grid place-items-center"><div className="orb orb-tiny" /></div>;

  return (
    <div className="px-4 pt-2 pb-10 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 grid place-items-center text-[#7a8388]" data-testid="settings-back">
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
              <div className="text-[13px] text-[#7a8388]">AI-stemme</div>
              <div className="text-white text-sm mt-0.5">{s.ai_voice}</div>
            </div>
            <select
              value={s.ai_voice}
              onChange={(e) => update("ai_voice", e.target.value)}
              data-testid="setting-voice"
              className="bg-[#141719] border border-line text-white text-xs rounded-lg px-2 py-1"
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
              <ChevronRight size={14} className="text-[#7a8388] ml-1" />
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <div className="text-[10px] text-[#5a6166] tracking-widest uppercase">Versjon 2.0.0</div>
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
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-mint" : "bg-[#22262a]"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}
