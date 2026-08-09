import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBar } from "../components/UIKit";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { ArrowRight, ChevronLeft, Eye, EyeOff } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(form);
      navigate("/app");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke opprette konto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-shell grain flex flex-col">
      
      <div className="px-6 pt-2 flex items-center">
        <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a8388]" data-testid="register-back">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-8 pt-4 flex-1">
        <h1 className="font-display text-[28px] tracking-tight text-white">Opprett konto</h1>
        <p className="text-[#7a8388] text-sm mt-2">Bli med KJAPP på under 30 sekunder</p>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <input className="input" placeholder="Fullt navn" value={form.fullName} onChange={change("fullName")} data-testid="register-name" required />
          <input className="input" type="email" placeholder="E-post" value={form.email} onChange={change("email")} data-testid="register-email" required />
          <div className="flex gap-3">
            <div className="w-24">
              <div className="input flex items-center gap-1 justify-center">
                <span>🇳🇴</span>
                <span className="text-[#e6ecef]">+47</span>
              </div>
            </div>
            <input className="input flex-1" placeholder="Telefonnummer" value={form.phone} onChange={change("phone")} data-testid="register-phone" />
          </div>
          <div className="relative">
            <input className="input pr-12" type={showPw ? "text" : "password"} placeholder="Passord (min. 6 tegn)" value={form.password} onChange={change("password")} data-testid="register-password" required />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a8388]" onClick={() => setShowPw((v) => !v)}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="register-error">
              {err}
            </div>
          )}

          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              data-testid="register-submit"
              className="w-14 h-14 rounded-full bg-mint text-[#04120a] grid place-items-center mint-glow hover:scale-105 active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#7a8388] leading-relaxed">
          Ved å opprette konto godtar du våre{" "}
          <Link to="/terms" className="text-mint">vilkår</Link> og{" "}
          <Link to="/privacy" className="text-mint">personvernregler</Link>.
        </p>
      </div>

      <div className="px-8 pb-10 text-center">
        <p className="text-[#7a8388] text-sm">
          Allerede konto?{" "}
          <Link to="/login" className="text-mint font-medium" data-testid="link-login">
            Logg inn
          </Link>
        </p>
      </div>
    </div>
  );
}
