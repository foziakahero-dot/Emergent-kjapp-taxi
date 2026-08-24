import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/**
 * KJAPP splash — extremely minimalist per Nordic Mobility brief.
 *  KJAPP     (Fraunces)
 *  NORDIC TAXI (tracking-[0.2em])
 *  Enklere. Tryggere. Kjappere.
 * Subtle diagonal gold shimmer across the 'A'. Luxury = controlled design.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReveal(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="phone-shell flex flex-col items-center justify-center relative"
      style={{ background: "var(--bg-base)" }}
      data-testid="onboarding"
    >
      {/* Ambient glow — very restrained */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "20% 15%",
          background: "radial-gradient(circle, rgba(203,163,101,0.06), transparent 65%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative flex flex-col items-center text-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <BrandMark />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: reveal ? 1 : 0 }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="mt-3 text-[10px] tracking-[0.42em] uppercase"
          style={{ color: "var(--accent)" }}
          data-testid="ob-tag"
        >
          Nordic Taxi
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: reveal ? 1 : 0, y: reveal ? 0 : 8 }}
          transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
          className="mt-12 font-display text-[19px] leading-[1.35] max-w-[280px]"
          style={{ color: "var(--text)" }}
        >
          Enklere. Tryggere. Kjappere.
        </motion.div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 px-8 pb-10 flex flex-col items-center gap-5">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: reveal ? 1 : 0, y: reveal ? 0 : 12 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          onClick={() => navigate("/login")}
          data-testid="onboarding-next"
          className="btn-primary w-full max-w-[300px]"
        >
          Kom i gang
        </motion.button>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: reveal ? 1 : 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          <button onClick={() => navigate("/driver/login")} data-testid="onboarding-driver-link" style={{ color: "var(--accent)" }}>
            Er du sjåfør?
          </button>
          <span className="mx-2 opacity-40">·</span>
          <button onClick={() => navigate("/apply/fleet")} data-testid="onboarding-loyver-link" style={{ color: "var(--accent)" }}>
            Bli løyvehaver
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="relative">
      <div
        className="font-display leading-none"
        style={{ color: "var(--text)", fontSize: 76, letterSpacing: "0.008em", fontWeight: 400 }}
        data-testid="ob-brand"
      >
        KJ
        <span
          style={{
            background: "linear-gradient(120deg, var(--accent) 0%, #F0D9A8 45%, var(--accent) 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            display: "inline-block",
          }}
        >
          A
        </span>
        PP
      </div>
      {/* Subtle diagonal shimmer across the 'A' */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: 0,
          left: "38%",
          width: "22%",
          height: "100%",
          background: "linear-gradient(120deg, transparent 0%, rgba(240,217,168,0.35) 50%, transparent 100%)",
          mixBlendMode: "screen",
          animation: "kjapp-shimmer 3.6s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes kjapp-shimmer {
          0%, 20% { transform: translateX(-140%); opacity: 0; }
          45%     { transform: translateX(0%);    opacity: 1; }
          70%,100% { transform: translateX(140%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
