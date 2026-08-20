import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "kjapp_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) {
      // slight delay so it doesn't compete with initial page paint
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(KEY, "all");
    setVisible(false);
  };
  const essential = () => {
    localStorage.setItem(KEY, "essential");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 right-3 bottom-3 z-[10000] rounded-2xl border border-line bg-[#131a1f]/95 backdrop-blur-xl p-4 shadow-2xl"
      data-testid="cookie-consent"
    >
      <div className="text-white text-sm font-medium">Vi bruker informasjonskapsler</div>
      <div className="text-[#a8b0a8] text-[12px] mt-1 leading-relaxed">
        KJAPP bruker cookies for pålogging, betaling og analyse. Les
        {" "}<Link to="/privacy" className="text-mint underline">personvernerklæringen</Link>
        {" "}og{" "}<Link to="/terms" className="text-mint underline">vilkårene</Link>.
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={essential}
          data-testid="cookie-essential"
          className="flex-1 rounded-full px-4 py-2 text-sm text-white border border-line hover:border-mint transition-colors"
        >
          Kun nødvendige
        </button>
        <button
          onClick={accept}
          data-testid="cookie-accept-all"
          className="flex-1 btn-primary text-sm"
        >
          Godta alle
        </button>
      </div>
    </div>
  );
}
