import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MailCheck } from "lucide-react";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch { /* always show same result — no enumeration */ }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="phone-shell grain flex flex-col">
      <div className="px-6 pt-2 flex items-center">
        <button onClick={() => navigate("/login")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="forgot-back">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-8 pt-4 flex-1">
        {sent ? (
          <div className="pt-10 text-center" data-testid="forgot-success">
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-5" style={{ background: "rgba(203,163,101,0.12)", color: "var(--accent)" }}>
              <MailCheck size={26} />
            </div>
            <h1 className="font-display text-[26px] tracking-tight text-white">Sjekk innboksen din</h1>
            <p className="text-[#7a827a] text-sm mt-3 leading-relaxed">
              Hvis kontoen finnes har vi sendt en lenke til <span style={{ color: "var(--text)" }}>{email}</span>.
              Lenken er gyldig i 1 time.
            </p>
            <button
              onClick={() => navigate("/login")}
              data-testid="forgot-to-login"
              className="mt-8 px-6 py-3 rounded-full text-[14px] font-medium"
              style={{ background: "var(--accent)", color: "#0B1013" }}
            >
              Tilbake til innlogging
            </button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[28px] tracking-tight text-white">Glemt passord?</h1>
            <p className="text-[#7a827a] text-sm mt-2">
              Skriv inn e-posten din, så sender vi deg en lenke for å velge nytt passord.
            </p>
            <form onSubmit={submit} className="mt-10 space-y-4">
              <input
                className="input"
                type="email"
                placeholder="E-post"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="forgot-email"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                data-testid="forgot-submit"
                className="w-full py-4 rounded-2xl text-[15px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#0B1013" }}
              >
                {loading ? "Sender…" : "Send tilbakestillingslenke"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
