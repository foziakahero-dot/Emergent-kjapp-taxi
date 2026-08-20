import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Clock, User, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Floating Command Bar — Nordic premium customer navigation.
 * - Cinematic: one centered "Bestill" pill at the bottom
 * - Tap the small menu handle → glidende ark viser Turer / Assistent / Konto
 * - Zero visual noise on the main screen (Airbnb 2023 vibe)
 */
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sheet, setSheet] = useState(false);
  const onHome = location.pathname === "/app";

  return (
    <>
      {/* Floating primary action */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[1005] pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
      >
        <div className={`max-w-[440px] mx-auto px-6 flex items-center ${onHome ? "justify-start" : "justify-center gap-3"} pointer-events-auto`}>
          {/* Small menu handle */}
          <button
            onClick={() => setSheet(true)}
            data-testid="nav-menu"
            aria-label="Meny"
            className="w-12 h-12 rounded-full grid place-items-center backdrop-blur-2xl border shrink-0"
            style={{
              background: "rgba(232, 224, 208, 0.06)",
              borderColor: "rgba(232, 224, 208, 0.12)",
            }}
          >
            <span className="flex flex-col gap-[3px]">
              <span className="w-4 h-[1.5px] bg-[#e8e0d0] rounded" />
              <span className="w-3 h-[1.5px] bg-[#e8e0d0] rounded" />
            </span>
          </button>

          {/* Home-back CTA — only on non-home pages */}
          {!onHome && (
            <button
              onClick={() => navigate("/app")}
              data-testid="nav-home-back"
              className="flex-1 h-12 rounded-full grid place-items-center backdrop-blur-2xl border"
              style={{
                background: "rgba(232, 224, 208, 0.06)",
                borderColor: "rgba(232, 224, 208, 0.12)",
                color: "#e8e0d0",
              }}
            >
              <span className="text-[14px] tracking-wide">← Til hjem</span>
            </button>
          )}
        </div>
      </div>

      {/* Command sheet */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheet(false)}
              className="absolute inset-0 z-[1010]"
              style={{ background: "rgba(4, 8, 10, 0.6)", backdropFilter: "blur(6px)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute left-0 right-0 bottom-0 z-[1011]"
              data-testid="nav-sheet"
            >
              <div
                className="max-w-[440px] mx-auto px-4 pt-4 pb-8 rounded-t-3xl border-t"
                style={{
                  background: "rgba(19, 26, 31, 0.96)",
                  borderColor: "rgba(232, 224, 208, 0.09)",
                  backdropFilter: "blur(28px)",
                  paddingBottom: "calc(env(safe-area-inset-bottom) + 26px)",
                }}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <span
                    className="text-[10px] tracking-[0.32em] uppercase"
                    style={{ color: "#7a827a" }}
                  >
                    KJAPP
                  </span>
                  <button
                    onClick={() => setSheet(false)}
                    data-testid="nav-sheet-close"
                    className="w-9 h-9 grid place-items-center rounded-full"
                    style={{ background: "rgba(232,224,208,0.05)" }}
                  >
                    <X size={16} style={{ color: "#e8e0d0" }} />
                  </button>
                </div>

                <SheetItem to="/app" icon={<Home size={20} />} label="Hjem" sub="Bestill din neste reise" testid="sheet-home" close={() => setSheet(false)} />
                <SheetItem to="/app/ai" icon={<Sparkles size={20} />} label="Assistent" sub="Spør KJAPP om alt taxi" testid="sheet-ai" close={() => setSheet(false)} />
                <SheetItem to="/app/history" icon={<Clock size={20} />} label="Turer" sub="Historikk og kvitteringer" testid="sheet-history" close={() => setSheet(false)} />
                <SheetItem to="/app/profile" icon={<User size={20} />} label="Konto" sub="Betaling, personvern, innstillinger" testid="sheet-profile" close={() => setSheet(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SheetItem({ to, icon, label, sub, testid, close }) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === to || (to !== "/app" && location.pathname.startsWith(to));
  return (
    <button
      onClick={() => { navigate(to); close(); }}
      data-testid={testid}
      className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl transition-colors mb-1"
      style={{
        background: active ? "rgba(201, 161, 91, 0.10)" : "transparent",
        border: `1px solid ${active ? "rgba(201, 161, 91, 0.28)" : "transparent"}`,
      }}
    >
      <div
        className="w-11 h-11 rounded-full grid place-items-center"
        style={{
          background: active ? "rgba(201, 161, 91, 0.18)" : "rgba(232, 224, 208, 0.05)",
          color: active ? "#c9a15b" : "#e8e0d0",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 text-left">
        <div className="font-display text-[18px] leading-tight" style={{ color: "#e8e0d0" }}>{label}</div>
        <div className="text-[12px]" style={{ color: "#7a827a" }}>{sub}</div>
      </div>
    </button>
  );
}
