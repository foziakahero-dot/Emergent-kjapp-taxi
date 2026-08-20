import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBar } from "../components/UIKit";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Car } from "lucide-react";

export default function DriverLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.role === "driver") navigate("/driver");
      else {
        setErr("Denne kontoen er ikke en sjåfør-konto. Bruk kunde-innlogging.");
      }
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Innlogging feilet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-shell grain flex flex-col">
      
      <div className="px-6 pt-2 flex items-center">
        <button onClick={() => navigate("/")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="dlogin-back">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-8 pt-4 flex-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-mint/10 grid place-items-center">
            <Car size={20} className="text-mint" />
          </div>
          <div>
            <div className="text-[11px] text-mint uppercase tracking-widest">Sjåfør-portal</div>
            <h1 className="font-display text-[24px] tracking-tight text-white">Kjør med KJAPP</h1>
          </div>
        </div>
        <p className="text-[#7a827a] text-sm mt-3 leading-relaxed">
          Logg inn for å motta turer, navigere og se dagens inntekt.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            className="input"
            placeholder="Sjåfør-e-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="dlogin-email"
            autoComplete="email"
            required
          />
          <div className="relative">
            <input
              className="input pr-12"
              type={showPw ? "text" : "password"}
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="dlogin-password"
              autoComplete="current-password"
              required
            />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a827a]" onClick={() => setShowPw((v) => !v)}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="dlogin-error">
              {err}
            </div>
          )}

          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              data-testid="dlogin-submit"
              className="w-14 h-14 rounded-full bg-mint text-[#04120a] grid place-items-center mint-glow hover:scale-105 active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </form>

        <div className="mt-10 card p-4">
          <div className="text-[11px] text-mint uppercase tracking-widest">Vil du bli sjåfør?</div>
          <p className="text-[#a8b0a8] text-sm mt-2 leading-relaxed">
            Sjåfør-kontoer opprettes kun via invitasjon fra en løyvehaver med flåte. Kontakt din flåte-eier for å få en registreringslenke.
          </p>
        </div>
      </div>

      <div className="px-8 pb-10 text-center">
        <p className="text-[#7a827a] text-sm">
          Er du kunde?{" "}
          <Link to="/login" className="text-mint font-medium" data-testid="dlogin-customer">
            Kunde-innlogging
          </Link>
        </p>
      </div>
    </div>
  );
}
