import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Orb } from "../components/UIKit";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail, api } from "../lib/api";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Apple } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const { login } = useAuth();

  // Detect standalone app mode (fleet.kjapp.no / admin.kjapp.no)
  const APP_MODE = (typeof window !== "undefined" && window.__KJAPP_MODE) || "main";
  const isFleetMode = APP_MODE === "fleet";
  const isAdminMode = APP_MODE === "admin";
  const isStandalone = isFleetMode || isAdminMode;
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/apple/config").then((r) => setAppleEnabled(!!r.data.enabled)).catch(() => {});
  }, []);

  async function loginWithApple() {
    if (!appleEnabled) {
      alert("Apple Sign In krever Apple Developer-konto ($99/år) og at APPLE_CLIENT_ID settes i backend .env. Backend-endepunktet er allerede klart.");
      return;
    }
    // Load Apple JS SDK
    if (!window.AppleID) {
      await new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        s.onload = resolve;
        document.head.appendChild(s);
      });
    }
    try {
      const { data: cfg } = await api.get("/auth/apple/config");
      window.AppleID.auth.init({
        clientId: cfg.client_id,
        scope: "name email",
        redirectURI: window.location.origin + "/auth/callback",
        usePopup: true,
      });
      const res = await window.AppleID.auth.signIn();
      const idToken = res.authorization?.id_token;
      const fullName = res.user ? `${res.user.name?.firstName || ""} ${res.user.name?.lastName || ""}`.trim() : undefined;
      const email = res.user?.email;
      const { data } = await api.post("/auth/apple", { identity_token: idToken, fullName, email });
      localStorage.setItem("kjapp_token", data.token);
      navigate(data.user.role === "admin" ? "/admin" : data.user.role === "driver" ? "/driver" : "/app");
    } catch (e) {
      alert("Apple-innlogging feilet: " + (e.response?.data?.detail || e.message));
    }
  }

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const u = await login(email, password);
      const dest = u.role === "superadmin" ? "/loyver" : u.role === "admin" ? "/admin" : u.role === "driver" ? "/driver" : u.role === "fleet_owner" ? "/fleet" : "/app";
      navigate(dest);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Innlogging feilet");
    } finally {
      setLoading(false);
    }
  };

  // Demo one-click login — fyll inn + submit i samme trykk
  const demoLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErr("");
    setLoading(true);
    try {
      const u = await login(demoEmail, demoPassword);
      const dest = u.role === "superadmin" ? "/loyver" : u.role === "admin" ? "/admin" : u.role === "driver" ? "/driver" : u.role === "fleet_owner" ? "/fleet" : "/app";
      navigate(dest);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Innlogging feilet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-shell grain flex flex-col">
      
      <div className="px-6 pt-2 flex items-center">
        <button onClick={() => navigate("/")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="login-back">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-8 pt-4 flex-1">
        <h1 className="font-display text-[28px] tracking-tight text-white">
          {isFleetMode ? "Flåte-eier innlogging" : isAdminMode ? "Admin innlogging" : "Velkommen tilbake"}
        </h1>
        <p className="text-[#7a827a] text-sm mt-2">
          {isFleetMode ? "Administrer sjåfører, utbetalinger og rapporter" : isAdminMode ? "Løyver, sjåfør-godkjenning og drift" : "Logg inn for å fortsette reisen"}
        </p>

        <form onSubmit={submit} className="mt-10 space-y-4">
          <input
            className="input"
            placeholder="E-post eller telefon"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="login-email"
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
              data-testid="login-password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a827a]"
              onClick={() => setShowPw((v) => !v)}
              aria-label="Vis passord"
              data-testid="login-toggle-pw"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              data-testid="login-forgot-password"
              className="text-[#7a827a] text-sm hover:text-mint transition-colors"
            >
              Glemt passord?
            </button>
          </div>

          {err && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="login-error">
              {err}
            </div>
          )}

          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-14 h-14 rounded-full bg-mint text-[#04120a] grid place-items-center mint-glow hover:scale-105 active:scale-95 transition-transform disabled:opacity-60"
            >
              {loading ? <span className="w-4 h-4 border-2 border-[#04120a] border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </form>

        <div className="mt-10 flex items-center gap-4">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[11px] text-[#7a827a] tracking-widest uppercase">eller fortsett med</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <SocialButton icon={<Apple size={20} />} testid="social-apple" onClick={loginWithApple} />
          <SocialButton icon={<GoogleIcon />} testid="social-google" onClick={loginWithGoogle} />
          <SocialButton icon={<PhoneIcon />} testid="social-phone" onClick={() => alert("SMS-logg inn kommer snart.")} />
        </div>
      </div>

      <div className="px-8 pb-10 text-center">
        <p className="text-[#7a827a] text-sm">
          Ingen konto?{" "}
          <Link to="/register" className="text-mint font-medium" data-testid="link-register">
            Opprett en
          </Link>
        </p>

        {/* Demo-innlogging for beta — én-klikk. Filtreres etter app-modus. */}
        <div className="mt-5 space-y-2">
          <div className="text-[10px] tracking-[0.3em] uppercase" style={{ color: "var(--accent)" }}>
            {isStandalone ? "Demo-innlogging" : "Demo-innlogging"}
          </div>
          <div className={`grid ${isStandalone ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
            {!isStandalone && (
              <DemoBtn
                testid="demo-passenger"
                label="Kunde"
                sub="Ola"
                onClick={() => demoLogin("ola@kjapp.no", "test1234")}
              />
            )}
            {!isStandalone && (
              <DemoBtn
                testid="demo-driver"
                label="Sjåfør"
                sub="Ola Sjåfør"
                onClick={() => demoLogin("sjafor@kjapp.no", "sjafor1234")}
              />
            )}
            {(!isStandalone || isFleetMode) && (
              <DemoBtn
                testid="demo-fleet"
                label="Flåte-eier"
                sub="Oslo Nord Taxi"
                onClick={() => demoLogin("floteier1@kjapp.no", "fleet1234")}
              />
            )}
            {(!isStandalone || isAdminMode) && (
              <DemoBtn
                testid="demo-admin"
                label="Superadmin"
                sub="Løyver + drift"
                onClick={() => demoLogin("admin@kjapp.no", "admin123")}
              />
            )}
          </div>
          <div className="text-[10px] text-[#5f6862] pt-1">Ett trykk logger deg rett inn på riktig panel</div>
        </div>

        {!isStandalone && (
          <p className="text-[#5f6862] text-xs mt-4">
            Er du sjåfør?{" "}
            <Link to="/driver/login" className="text-mint" data-testid="link-driver-login">
              Sjåfør-innlogging
            </Link>
            <span className="mx-2 opacity-40">·</span>
            <Link to="/apply/fleet" className="text-mint" data-testid="link-loyver-apply">
              Bli løyvehaver
            </Link>
          </p>
        )}
        {isFleetMode && (
          <p className="text-[#5f6862] text-xs mt-4 text-center">
            Ikke registrert flåte enda?{" "}
            <Link to="/apply" className="text-mint" data-testid="link-fleet-apply">
              Søk om løyve
            </Link>
          </p>
        )}
        <p className="text-[#5f6862] text-[11px] mt-4">
          <Link to="/privacy" className="hover:text-mint">Personvern</Link>
          <span className="mx-2">·</span>
          <Link to="/terms" className="hover:text-mint">Vilkår</Link>
        </p>
      </div>
    </div>
  );
}

function DemoBtn({ testid, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="text-left px-3 py-2 rounded-xl transition-colors hover:border-mint"
      style={{ background: "rgba(201,161,91,0.08)", border: "1px solid rgba(201,161,91,0.20)" }}
    >
      <div className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>{label}</div>
      <div className="text-[10px] text-[#a8b0a8] truncate">{sub}</div>
    </button>
  );
}

function SocialButton({ icon, testid, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="w-14 h-14 rounded-full card grid place-items-center text-white hover:border-mint transition-colors"
    >
      {icon}
    </button>
  );
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function loginWithGoogle() {
  const redirectUrl = window.location.origin + "/auth/callback";
  const oauthUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  // In PWA standalone mode (Safari iOS, some Android), full-page redirect to external
  // OAuth providers can fail silently. Open in a new tab / external browser instead.
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    const win = window.open(oauthUrl, "_blank", "noopener");
    // Some PWAs block window.open — fall back to full-page redirect
    if (!win) window.location.href = oauthUrl;
    return;
  }
  window.location.href = oauthUrl;
}
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.1 1.5l3-3C17.5 1.7 15 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.5 2.7C6 7.3 8.8 5 12 5z"/>
      <path fill="#34A853" d="M23 12c0-.8-.1-1.6-.2-2.3H12v4.6h6.2c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-1.9 3.6-4.8 3.6-8.4z"/>
      <path fill="#4A90E2" d="M5.1 14.3c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L1.6 7.8C.9 9.2.5 10.5.5 12s.4 2.8 1.1 4.2l3.5-1.9z"/>
      <path fill="#FBBC05" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.8 1.1-3.2 0-5.9-2.3-6.9-5.4L1.6 16C3.5 20.4 7.4 23 12 23z"/>
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1l-1.3 1.3a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/>
    </svg>
  );
}
