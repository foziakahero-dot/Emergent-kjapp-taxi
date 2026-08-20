import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { driverApi } from "../lib/api";
import { ChevronLeft, Wallet, TrendingUp, Calendar } from "lucide-react";

export default function DriverPayouts() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { driverApi.payouts().then(setData).catch(() => {}); }, []);

  if (!data) return <div className="min-h-[50vh] grid place-items-center"><div className="orb orb-small" /></div>;

  const dateFmt = (iso) => new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "short" });

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="driver-payouts-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} data-testid="payouts-back" className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-line">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white">Utbetalinger</h1>
      </div>

      <div className="card p-5">
        <div className="text-[11px] text-mint uppercase tracking-widest flex items-center gap-2">
          <Wallet size={12} /> Neste utbetaling
        </div>
        <div className="mt-1 font-display text-4xl text-white" data-testid="payouts-net">{data.pending_net} kr</div>
        <div className="mt-1 text-[13px] text-[#8a94a8]">
          <Calendar size={12} className="inline mr-1" />
          {dateFmt(data.next_payout_date)}
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-line text-[12px]">
          <div>
            <div className="text-[#8a94a8]">Brutto</div>
            <div className="text-white font-medium">{data.pending_gross} kr</div>
          </div>
          <div>
            <div className="text-[#8a94a8]">Turer</div>
            <div className="text-white font-medium">{data.pending_trips}</div>
          </div>
          <div>
            <div className="text-[#8a94a8]">KJAPP</div>
            <div className="text-white font-medium">−{data.commission_pct}%</div>
          </div>
        </div>
      </div>

      <div className="mt-6 px-1">
        <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-2">
          <TrendingUp size={14} /> Tidligere utbetalinger
        </h2>
        {data.history.length === 0 ? (
          <div className="card p-5 text-center text-[#8a94a8] text-sm">Ingen utbetalinger ennå</div>
        ) : (
          <div className="space-y-2">
            {data.history.map((p) => (
              <div key={p.id} className="card p-4 flex items-center gap-3" data-testid={`payout-${p.id}`}>
                <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
                  <Wallet size={16} className="text-mint" />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{dateFmt(p.period_start)} → {dateFmt(p.period_end)}</div>
                  <div className="text-[11px] text-[#8a94a8]">{p.trips} turer</div>
                </div>
                <div className="text-white font-semibold">{p.net} kr</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 card-soft p-4 text-[12px] text-[#8a94a8]">
        Utbetaling skjer hver mandag for uken før. KJAPP holder tilbake {data.commission_pct}% som plattform-avgift. Alle utbetalinger er skattepliktig — se dine 1099-tall i «Skattemeldinger» (kommer snart).
      </div>
    </div>
  );
}
