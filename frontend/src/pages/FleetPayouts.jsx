import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApi } from "../lib/api";
import { ChevronLeft, Wallet, FileSpreadsheet, Download } from "lucide-react";

const MONTHS = ["Januar","Februar","Mars","April","Mai","Juni","Juli","August","September","Oktober","November","Desember"];

export default function FleetPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [dl, setDl] = useState(null);
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  useEffect(() => { fleetApi.payouts().then((r) => setPayouts(r.payouts || [])).catch(() => {}); }, []);

  const dateFmt = (iso) => iso ? new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) : "";

  const exportXlsx = async () => {
    try {
      setDl("loading");
      const res = await fleetApi.exportMonthly(year, month);
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kjapp_${year}-${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDl("done");
      setTimeout(() => setDl(null), 2000);
    } catch (e) {
      alert("Kunne ikke laste ned rapport: " + (e.response?.data?.detail || e.message));
      setDl(null);
    }
  };

  return (
    <div className="px-4 pt-4 pb-16 page-enter" data-testid="fleet-payouts-page">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 grid place-items-center rounded-full bg-white/5 border border-line">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display text-2xl text-white">Utbetalinger</h1>
      </div>

      {/* Månedlig regnskap-eksport (tax-ready) */}
      <div className="card p-4 mb-4 border-mint/20" data-testid="fleet-export-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-mint/10 grid place-items-center">
            <FileSpreadsheet size={16} className="text-mint" />
          </div>
          <div>
            <div className="text-white text-sm font-medium">Månedsrapport (Excel)</div>
            <div className="text-[11px] text-[#7a827a]">Klar for regnskapsfører · turer · sjåfør-brekke · brutto/netto</div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="input flex-1"
            data-testid="fleet-export-month"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input w-24"
            data-testid="fleet-export-year"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportXlsx}
          disabled={dl === "loading"}
          data-testid="fleet-export-download"
          className="mt-3 w-full h-11 rounded-full bg-mint text-[#04120a] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mint-glow"
        >
          <Download size={16} />
          {dl === "loading" ? "Genererer…" : dl === "done" ? "Lastet ned ✓" : `Last ned ${MONTHS[month - 1]} ${year}`}
        </button>
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
