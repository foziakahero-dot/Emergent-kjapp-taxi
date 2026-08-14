import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";

export default function PaymentCancel() {
  const [params] = useSearchParams();
  const tripId = params.get("trip_id");
  const navigate = useNavigate();
  return (
    <div className="phone-shell grain min-h-screen flex flex-col items-center justify-center px-8 text-center" data-testid="payment-cancel-page">
      <div className="w-20 h-20 rounded-full bg-[#17223a] border border-line grid place-items-center">
        <X size={28} className="text-white" />
      </div>
      <div className="text-white text-2xl font-display mt-6">Betaling avbrutt</div>
      <div className="text-[#8a94a8] text-sm mt-2">Du ble ikke belastet. Du kan prøve igjen fra kvitteringen.</div>
      <button
        onClick={() => navigate(tripId ? `/app/receipt/${tripId}` : "/app")}
        data-testid="payment-cancel-back"
        className="btn-primary mt-8"
      >
        Tilbake til kvittering
      </button>
    </div>
  );
}
