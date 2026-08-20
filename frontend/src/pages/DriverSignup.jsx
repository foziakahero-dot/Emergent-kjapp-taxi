import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { StatusBar } from "../components/UIKit";
import { driverInviteApi, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowRight, Car, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function DriverSignup() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    driverInviteApi.get(token)
      .then(setInvite)
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke laste invitasjonen"))
      .finally(() => setLoading(false));
  }, [token]);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const res = await driverInviteApi.accept({ token, ...form });
      localStorage.setItem("kjapp_token", res.token);
      await refresh();
      setDone(true);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke registrere");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="phone-shell grain flex items-center justify-center">
        <div className="orb orb-tiny" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="phone-shell grain flex flex-col">
        
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 grid place-items-center">
            <ShieldCheck size={22} className="text-red-400" />
          </div>
          <h1 className="mt-4 text-white text-lg">Ugyldig invitasjon</h1>
          <p className="text-[#7a827a] text-sm mt-2">{err || "Denne lenken finnes ikke, er brukt eller utløpt."}</p>
          <button onClick={() => navigate("/")} className="btn-primary mt-6" data-testid="dsignup-home">Til forsiden</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="phone-shell grain flex flex-col">
        
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-mint grid place-items-center mint-glow">
            <ShieldCheck size={24} className="text-[#04120a]" />
          </div>
          <h1 className="mt-4 text-white text-lg font-medium">Registrering mottatt!</h1>
          <p className="text-[#7a827a] text-sm mt-2 max-w-[280px]">
            Vi må godkjenne kontoen din før du kan motta turer. Din flåte-eier eller KJAPP vil godkjenne deg snart.
          </p>
          <button onClick={() => navigate("/driver/login")} className="btn-ghost mt-6" data-testid="dsignup-continue">Til innlogging</button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-shell grain flex flex-col">
      
      <div className="px-8 pt-4">
        <div className="text-[11px] text-mint uppercase tracking-widest">Sjåfør-registrering</div>
        <h1 className="font-display text-[24px] tracking-tight text-white mt-1">Velkommen til flåten</h1>
        <div className="mt-4 card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center">
            <Car size={18} className="text-mint" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#7a827a]">Bil tildelt</div>
            <div className="text-white text-sm">{invite.car} · {invite.plate}</div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="px-8 pt-6 space-y-4 flex-1">
        <input className="input" placeholder="Fullt navn" value={form.fullName} onChange={change("fullName")} data-testid="dsignup-name" required />
        <input className="input" type="email" placeholder="E-post" value={form.email} onChange={change("email")} data-testid="dsignup-email" required />
        <input className="input" placeholder="Telefonnummer" value={form.phone} onChange={change("phone")} data-testid="dsignup-phone" required />
        <div className="relative">
          <input className="input pr-12" type={showPw ? "text" : "password"} placeholder="Passord (min. 6 tegn)" value={form.password} onChange={change("password")} data-testid="dsignup-password" required />
          <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a827a]" onClick={() => setShowPw((v) => !v)}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {err && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="dsignup-error">{err}</div>
        )}

        <p className="text-[11px] text-[#7a827a] leading-relaxed">
          Ved å registrere deg godtar du KJAPPs{" "}
          <Link to="/terms" className="text-mint">sjåfør-vilkår</Link> og{" "}
          <Link to="/privacy" className="text-mint">personvernerklæring</Link>. KJAPP behandler personopplysninger for å tildele turer.
        </p>

        <div className="pt-2 flex justify-center pb-10">
          <button
            type="submit"
            disabled={submitting}
            data-testid="dsignup-submit"
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" /> : <>Send til godkjenning <ArrowRight size={18} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
