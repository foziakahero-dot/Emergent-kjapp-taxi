import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const slides = [
  {
    kind: "logo",
    subtitle: "Nordic taxi.\nEnkel og trygg — hvor du enn skal.",
  },
  {
    kind: "route",
    title: "Alltid en bil i nærheten.",
    subtitle: "Vi finner nærmeste sjåfør automatisk.",
  },
  {
    kind: "car",
    title: "Rettferdige priser. Norske sjåfører.",
    subtitle: "Ingen skjulte tillegg. Bare god taxi.",
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
              <h1 className="mt-14 font-display text-[26px] tracking-tight max-w-[300px]" style={{ color: "var(--text)" }}>
                {s.title}
              </h1>
            )}
            <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line max-w-[290px]" style={{ color: "var(--text-muted)" }}>
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
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: idx === i ? 32 : 16,
                background: idx === i ? "var(--accent)" : "rgba(232,224,208,0.14)",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-6 w-full">
          <button
            onClick={skip}
            data-testid="onboarding-skip"
            className="text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
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
        <div className="pt-2 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
          <button onClick={() => navigate("/driver/login")} className="hover:opacity-90" data-testid="onboarding-driver-link" style={{ color: "var(--accent)" }}>
            Er du sjåfør?
          </button>
          <span className="mx-2 opacity-40">·</span>
          <button onClick={() => navigate("/apply/fleet")} className="hover:opacity-90" data-testid="onboarding-loyver-link" style={{ color: "var(--accent)" }}>
            Bli løyvehaver
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="text-center">
      <div className="font-display text-[64px] tracking-[0.01em] leading-none" style={{ color: "var(--text)" }}>
        KJ<span style={{ color: "var(--accent)" }}>A</span>PP
      </div>
      <div className="mt-2 text-[10px] tracking-[0.4em] uppercase" style={{ color: "var(--accent)" }}>
        Nordic taxi
      </div>
    </div>
  );
}

/* Slide 2 — subtle map route, brass palette */
function RouteMark() {
  return (
    <div className="w-52 h-52 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "rgba(201,161,91,0.08)" }} />
      <svg viewBox="0 0 200 200" className="w-52 h-52 relative">
        <defs>
          <linearGradient id="ob-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0b876" />
            <stop offset="100%" stopColor="#c9a15b" />
          </linearGradient>
        </defs>
        {/* subtle grid backdrop */}
        <g opacity="0.08" stroke="#e8e0d0" strokeWidth="0.6">
          <line x1="0" y1="60" x2="200" y2="60" />
          <line x1="0" y1="120" x2="200" y2="120" />
          <line x1="60" y1="0" x2="60" y2="200" />
          <line x1="140" y1="0" x2="140" y2="200" />
        </g>
        {/* route path */}
        <path
          d="M 40 150 Q 70 120 90 110 Q 120 95 130 70 Q 140 45 160 40"
          fill="none"
          stroke="url(#ob-route)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* start pin */}
        <circle cx="40" cy="150" r="12" fill="#c9a15b" opacity="0.18" />
        <circle cx="40" cy="150" r="5" fill="#c9a15b" />
        {/* end pin — checker flag */}
        <circle cx="160" cy="40" r="12" fill="#0c1216" />
        <rect x="156" y="36" width="8" height="8" fill="#f4ecd8" />
        <rect x="158" y="36" width="2" height="2" fill="#c9a15b" />
        <rect x="162" y="36" width="2" height="2" fill="#c9a15b" />
        <rect x="156" y="38" width="2" height="2" fill="#c9a15b" />
        <rect x="160" y="38" width="2" height="2" fill="#c9a15b" />
        <rect x="158" y="40" width="2" height="2" fill="#c9a15b" />
        <rect x="162" y="40" width="2" height="2" fill="#c9a15b" />
      </svg>
    </div>
  );
}

/* Slide 3 — premium isometric taxi, brass palette */
function TaxiMark() {
  return (
    <div className="w-52 h-52 relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "rgba(201,161,91,0.10)" }} />
      <svg viewBox="0 0 120 120" className="w-52 h-52 relative">
        <defs>
          <linearGradient id="ob-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2f36" />
            <stop offset="60%" stopColor="#171a1e" />
            <stop offset="100%" stopColor="#0c1216" />
          </linearGradient>
          <linearGradient id="ob-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0b876" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#c9a15b" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="#0c1216" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a15b" strokeOpacity="0.25" strokeWidth="1" />
        {/* subtle inner ring */}
        <circle cx="60" cy="60" r="44" fill="none" stroke="#c9a15b" strokeOpacity="0.12" strokeWidth="0.6" strokeDasharray="2 6" />
        <g transform="translate(60 60) scale(2.6)">
          {/* ground shadow */}
          <ellipse cx="1" cy="2" rx="8" ry="12" fill="#000" opacity="0.35" />
          {/* body silhouette */}
          <path
            d="M -7 -13 Q -7 -15 -5 -15 L 5 -15 Q 7 -15 7 -13 L 7 13 Q 7 15 5 15 L -5 15 Q -7 15 -7 13 Z"
            fill="url(#ob-body)"
            stroke="#c9a15b"
            strokeWidth="0.7"
          />
          {/* roof (subtle highlight) */}
          <rect x="-5.6" y="-8" width="11.2" height="14" rx="1.2" fill="#ffffff" fillOpacity="0.04" />
          {/* windshield */}
          <path d="M -5 -11.5 Q -5 -13 -3.4 -13 L 3.4 -13 Q 5 -13 5 -11.5 L 5 -6.5 L -5 -6.5 Z" fill="url(#ob-glass)" />
          {/* rear window */}
          <path d="M -5 6 L 5 6 L 5 11.5 Q 5 13 3.4 13 L -3.4 13 Q -5 13 -5 11.5 Z" fill="url(#ob-glass)" fillOpacity="0.4" />
          {/* headlights */}
          <ellipse cx="-3.6" cy="-13.7" rx="1.1" ry="0.55" fill="#fff9e8" />
          <ellipse cx="3.6" cy="-13.7" rx="1.1" ry="0.55" fill="#fff9e8" />
          {/* taillights */}
          <rect x="-4.5" y="13.3" width="1.5" height="0.9" rx="0.4" fill="#d76a5a" />
          <rect x="3" y="13.3" width="1.5" height="0.9" rx="0.4" fill="#d76a5a" />
        </g>
      </svg>
    </div>
  );
}
