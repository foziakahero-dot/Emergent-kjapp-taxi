import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const slides = [
  {
    kind: "logo",
    subtitle: "Enkel og trygg\ntransport, hvor du enn skal.",
  },
  {
    kind: "route",
    title: "Alltid en bil i nærheten.",
    subtitle: "Vi finner nærmeste sjåfør automatisk.",
  },
  {
    kind: "car",
    title: "Snille priser. Vennlige sjåfører.",
    subtitle: "Ingen påslag i rushtid. Bare rettferdig norsk taxi.",
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
    <div className="phone-shell grain flex flex-col" data-testid="onboarding">
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
            {s.kind === "logo" && <BrandMark />}
            {s.kind === "route" && <RouteMark />}
            {s.kind === "car" && <TaxiMark />}

            {s.title && (
              <h1 className="mt-14 font-display text-[26px] tracking-tight text-white max-w-[300px]">
                {s.title}
              </h1>
            )}
            <p className="mt-4 text-[15px] leading-relaxed text-[#a9b1c4] whitespace-pre-line max-w-[290px]">
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
                idx === i ? "w-8 bg-mint" : "w-4 bg-[#2a3550]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-6 w-full">
          <button
            onClick={skip}
            data-testid="onboarding-skip"
            className="text-[#8a94a8] text-sm hover:text-white transition-colors"
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
        Norsk taxi
      </div>
    </div>
  );
}

// Slide 2 — minimal route/map icon (no robotic AI orb)
function RouteMark() {
  return (
    <div className="w-44 h-44 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-mint/8 blur-3xl" />
      <svg viewBox="0 0 200 200" className="w-44 h-44 relative">
        {/* subtle grid backdrop */}
        <g opacity="0.15" stroke="#2fe08c" strokeWidth="0.6">
          <line x1="0" y1="60" x2="200" y2="60" />
          <line x1="0" y1="120" x2="200" y2="120" />
          <line x1="60" y1="0" x2="60" y2="200" />
          <line x1="140" y1="0" x2="140" y2="200" />
        </g>
        {/* route path */}
        <path
          d="M 40 150 Q 70 120 90 110 Q 120 95 130 70 Q 140 45 160 40"
          fill="none"
          stroke="#2fe08c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0"
        />
        {/* start pin */}
        <circle cx="40" cy="150" r="10" fill="#2fe08c" opacity="0.2" />
        <circle cx="40" cy="150" r="5" fill="#2fe08c" />
        {/* end pin */}
        <circle cx="160" cy="40" r="10" fill="#ffffff" opacity="0.15" />
        <rect x="155" y="35" width="10" height="10" rx="1.5" fill="#ffffff" />
      </svg>
    </div>
  );
}

// Slide 3 — professional top-down taxi (matches map marker)
function TaxiMark() {
  return (
    <div className="w-44 h-44 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-mint/10 blur-3xl" />
      <svg viewBox="0 0 100 100" className="w-44 h-44 relative">
        <circle cx="50" cy="50" r="45" fill="#111a2b" stroke="#2fe08c" strokeOpacity="0.25" strokeWidth="1" />
        <g transform="translate(50 50) scale(2.6)">
          {/* body */}
          <path
            d="M -6 -10 Q -6 -12 -4 -12 L 4 -12 Q 6 -12 6 -10 L 6 10 Q 6 12 4 12 L -4 12 Q -6 12 -6 10 Z"
            fill="#17223a"
            stroke="#2fe08c"
            strokeWidth="0.6"
          />
          {/* windshield */}
          <path d="M -4.5 -9 Q -4.5 -10 -3 -10 L 3 -10 Q 4.5 -10 4.5 -9 L 4.5 -3 L -4.5 -3 Z" fill="#2fe08c" fillOpacity="0.35" />
          {/* rear window */}
          <path d="M -4.5 3 L 4.5 3 L 4.5 9 Q 4.5 10 3 10 L -3 10 Q -4.5 10 -4.5 9 Z" fill="#2fe08c" fillOpacity="0.22" />
          {/* headlights */}
          <circle cx="-3.6" cy="-11" r="0.7" fill="#ffffff" />
          <circle cx="3.6" cy="-11" r="0.7" fill="#ffffff" />
          {/* side mirrors */}
          <rect x="-7" y="-6" width="1" height="1.6" fill="#2fe08c" opacity="0.7" />
          <rect x="6" y="-6" width="1" height="1.6" fill="#2fe08c" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
