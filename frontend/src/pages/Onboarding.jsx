import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StatusBar, Orb } from "../components/UIKit";

const slides = [
  {
    logo: true,
    subtitle: "Din premium reise,\nkun ett pust unna.",
  },
  {
    title: "AI som forstår deg.",
    subtitle: "Reiser som tilpasser seg deg.",
    orb: "medium",
  },
  {
    title: "Trygghet. Komfort.",
    subtitle: "Teknologi som bryr seg.",
    car: true,
  },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const navigate = useNavigate();

  const next = () => {
    if (i < slides.length - 1) setI(i + 1);
    else navigate("/login");
  };
  const skip = () => navigate("/login");

  const s = slides[i];

  return (
    <div className="phone-shell grain flex flex-col">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="flex flex-col items-center text-center"
          >
            {s.logo && <BrandMark />}
            {s.orb && <Orb size="default" />}
            {s.car && <CarSilhouette />}

            {s.title && (
              <h1 className="mt-14 font-display text-[28px] tracking-tight text-white">
                {s.title}
              </h1>
            )}
            <p className="mt-4 text-[15px] leading-relaxed text-[#8a9095] whitespace-pre-line max-w-[280px]">
              {s.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-8 pb-10 flex flex-col items-center gap-6">
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-[3px] rounded-full transition-all duration-500 ${
                idx === i ? "w-8 bg-mint" : "w-4 bg-[#22262a]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-6 w-full">
          <button
            onClick={skip}
            data-testid="onboarding-skip"
            className="text-[#7a8388] text-sm hover:text-white transition-colors"
          >
            Hopp over
          </button>
          <button
            onClick={next}
            data-testid="onboarding-next"
            className="btn-primary ml-auto"
          >
            {i < slides.length - 1 ? "Neste" : "Kom i gang"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="text-center">
      <div className="font-display text-[52px] tracking-[0.02em] leading-none text-white">
        KJ<span className="text-mint">A</span>PP
      </div>
      <div className="mt-2 text-[10px] tracking-[0.4em] text-mint uppercase">
        Smart AI Taxi
      </div>
    </div>
  );
}

function CarSilhouette() {
  return (
    <div className="w-40 h-40 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-mint/10 blur-3xl" />
      <svg viewBox="0 0 200 100" className="w-40 relative" fill="none">
        <path
          d="M20 70 Q30 40 60 35 L140 35 Q170 40 180 70 L180 78 L20 78 Z"
          fill="#0e1113"
          stroke="#2fe08c"
          strokeWidth="1.2"
          opacity="0.7"
        />
        <circle cx="55" cy="78" r="10" fill="#141719" stroke="#2fe08c" strokeWidth="1" />
        <circle cx="145" cy="78" r="10" fill="#141719" stroke="#2fe08c" strokeWidth="1" />
        <path d="M65 38 L80 55 L120 55 L135 38" stroke="#2fe08c" strokeWidth="0.8" opacity="0.4" />
      </svg>
    </div>
  );
}
