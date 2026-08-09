import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi } from "../lib/api";
import { ProgressRing, Orb } from "../components/UIKit";
import { ChevronLeft } from "lucide-react";

export default function DriverSummary() {
  const [summary, setSummary] = useState({ income: 0, trips: 0, satisfaction: 98 });
  const navigate = useNavigate();

  useEffect(() => {
    driverApi.summary().then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="px-4 pt-2 pb-24 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/driver")} className="w-10 h-10 grid place-items-center text-[#7a8388]" data-testid="dsum-back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-white text-lg font-medium">Dagens oppsummering</h1>
      </div>

      <div className="card p-6 flex flex-col items-center">
        <ProgressRing value={Math.min(100, (summary.income / 1500) * 100)} size={160} stroke={8}>
          <div className="text-center">
            <div className="font-display text-2xl text-white leading-none">{summary.income.toLocaleString("nb-NO")}</div>
            <div className="text-mint text-[11px] mt-1 uppercase tracking-widest">kr i dag</div>
          </div>
        </ProgressRing>
        <div className="mt-4 text-[#7a8388] text-xs">Betalt av kunde · via Vipps/kort</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-[10px] text-[#7a8388] uppercase tracking-widest">Turer</div>
          <div className="font-display text-3xl text-white mt-2">{summary.trips}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] text-[#7a8388] uppercase tracking-widest">Tilfredshet</div>
          <div className="font-display text-3xl text-white mt-2">{summary.satisfaction}%</div>
        </div>
      </div>

      <div className="mt-4 card p-4 flex items-center gap-3">
        <Orb size="tiny" />
        <div className="flex-1">
          <div className="text-white text-sm font-medium">Godt jobbet!</div>
          <div className="text-[#7a8388] text-xs">KJAPP AI analyserer dagen for deg. Fortsett den gode innsatsen.</div>
        </div>
      </div>
    </div>
  );
}
