import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi } from "../lib/api";
import { ChevronLeft, Wallet } from "lucide-react";

export default function FleetPayouts() {
  const [payouts, setPayouts] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { fleetApi.payouts().then((r) => setPayouts(r.payouts || [])).catch(() => {}); }, []);

  const dateFmt = (iso) => iso ? new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) : "";

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="fleet-payouts-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-line">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white">Utbetalinger</h1>
      </div>

      {payouts.length === 0 ? (
        <div className="card p-6 text-center text-[#7a827a] text-sm" data-testid="no-payouts">
          Ingen utbetalinger registrert ennå. Første utbetaling skjer neste mandag.
        </div>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="card p-4 flex items-center gap-3" data-testid={`payout-${p.id}`}>
              <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
                <Wallet size={16} className="text-mint" />
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{dateFmt(p.period_start)} → {dateFmt(p.period_end)}</div>
                <div className="text-[11px] text-[#7a827a]">{p.trips || 0} turer · brutto {p.gross || 0} kr</div>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">{p.net || 0} kr</div>
                <div className="text-[10px] uppercase tracking-widest text-mint">{p.status || "planlagt"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
