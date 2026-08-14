import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paymentsApi } from "../lib/api";
import { Check } from "lucide-react";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("checking");
  const [tripId, setTripId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const r = await paymentsApi.status(sessionId);
        setTripId(r.trip_id);
        if (r.payment_status === "paid") { setStatus("paid"); return; }
        if (r.payment_status === "expired" || r.payment_status === "failed") { setStatus("failed"); return; }
        if (tries >= 8) { setStatus("timeout"); return; }
        setTimeout(tick, 2000);
      } catch (e) {
        setStatus("error");
      }
    };
    tick();
  }, [sessionId]);

  return (
    <div className="phone-shell grain min-h-screen flex flex-col items-center justify-center px-8 text-center" data-testid="payment-success-page">
      {status === "checking" && (
        <>
          <div className="orb orb-small" />
          <div className="text-white text-lg mt-6">Bekrefter betaling…</div>
          <div className="text-[#8a94a8] text-sm mt-1">Dette tar noen sekunder</div>
        </>
      )}
      {status === "paid" && (
        <>
          <div className="w-20 h-20 rounded-full bg-mint grid place-items-center mint-glow">
            <Check size={32} className="text-[#04120a]" />
          </div>
          <div className="text-white text-2xl font-display mt-6">Betaling fullført</div>
          <div className="text-[#8a94a8] text-sm mt-2">Takk for at du reiste med KJAPP.</div>
          <button
            onClick={() => navigate(tripId ? `/app/receipt/${tripId}` : "/app")}
            data-testid="payment-success-continue"
            className="btn-primary mt-8"
          >
            Gå til kvittering
          </button>
        </>
      )}
      {(status === "failed" || status === "error" || status === "timeout") && (
        <>
          <div className="text-white text-lg">Noe gikk galt</div>
          <div className="text-[#8a94a8] text-sm mt-2">Vi klarte ikke å bekrefte betalingen. Prøv igjen.</div>
          <button onClick={() => navigate("/app")} className="btn-primary mt-6">Til hjem</button>
        </>
      )}
    </div>
  );
}
