import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tripsApi } from "../lib/api";
import { Star, Share2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TripReceipt() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    tripsApi.get(tripId).then(setTrip).catch(() => {});
  }, [tripId]);

  const submit = async () => {
    await tripsApi.rate(tripId, { rating, feedback: "" });
    setSubmitted(true);
    setTimeout(() => navigate("/app"), 1200);
  };

  if (!trip) return <div className="min-h-[60vh] grid place-items-center"><div className="orb orb-small" /></div>;

  return (
    <div className="px-6 pt-4 pb-10 page-enter">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center pt-6"
      >
        <div className="w-16 h-16 rounded-full bg-mint grid place-items-center mint-glow">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#04120a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mt-4 text-[11px] text-mint uppercase tracking-widest">Kvittering</div>
        <div className="text-white text-lg mt-1">Takk for turen!</div>
        <div className="font-display text-[56px] text-white mt-6">{trip.price} <span className="text-2xl align-top mt-2 inline-block">kr</span></div>
        <div className="text-[13px] text-[#7a8388]">Betalt med Vipps</div>
      </motion.div>

      <div className="mt-8 card p-4 space-y-3">
        <Row label="Fra" value={trip.pickup_address} />
        <Row label="Til" value={trip.dropoff_address} />
        <Row label="Avstand" value={`${trip.distance_km} km`} />
        <Row label="Varighet" value={`${trip.duration_min} min`} />
        <Row label="Sjåfør" value={`${trip.driver?.name} · ${trip.driver?.car}`} />
      </div>

      {!submitted ? (
        <div className="mt-6 card p-5">
          <div className="text-white font-medium mb-1">Vurder turen</div>
          <div className="text-[13px] text-[#7a8388] mb-4">Hvordan var opplevelsen?</div>
          <div className="flex items-center justify-center gap-2">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n)} data-testid={`rate-${n}`} className="transition-transform hover:scale-110">
                <Star size={34} fill={n <= rating ? "#2fe08c" : "transparent"} stroke={n <= rating ? "#2fe08c" : "#7a8388"} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <button onClick={submit} data-testid="rate-submit" className="btn-primary w-full mt-5">
            Send vurdering
          </button>
        </div>
      ) : (
        <div className="mt-6 card p-5 text-center">
          <div className="text-mint text-sm">Takk for tilbakemeldingen! ✨</div>
        </div>
      )}

      <button onClick={() => navigate("/app")} data-testid="receipt-done" className="btn-ghost w-full mt-6">
        Ferdig
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[#7a8388]">{label}</span>
      <span className="text-white text-right flex-1 truncate">{value}</span>
    </div>
  );
}
