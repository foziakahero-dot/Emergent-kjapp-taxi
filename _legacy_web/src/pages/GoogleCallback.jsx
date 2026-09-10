import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { consumeGoogleFlow, googleRedirectUri } from "../lib/googleAuth";

/** Callback for KJAPP-owned Google OAuth. Exchanges ?code= for a KJAPP session server-side.
 *  REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (params.get("error") || !code) {
      navigate("/login?err=google", { replace: true });
      return;
    }
    const verifier = consumeGoogleFlow(state);
    if (!verifier) {
      navigate("/login?err=google", { replace: true });
      return;
    }
    authApi
      .googleCode({ code, code_verifier: verifier, redirect_uri: googleRedirectUri() })
      .then((res) => {
        const u = applySession(res);
        const dest =
          u.role === "superadmin" ? "/loyver"
            : u.role === "admin" ? "/admin"
              : u.role === "driver" ? "/driver"
                : u.role === "fleet_owner" ? "/fleet"
                  : "/app";
        navigate(dest, { replace: true });
      })
      .catch(() => {
        setError("Google-innlogging feilet");
        setTimeout(() => navigate("/login?err=google", { replace: true }), 1200);
      });
  }, [applySession, navigate]);

  return (
    <div className="phone-shell grid place-items-center" data-testid="google-callback">
      <div className="text-center px-8">
        <div
          className="w-12 h-12 mx-auto rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(203,163,101,0.25)", borderTopColor: "var(--accent)" }}
        />
        <p className="mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          {error || "Logger deg inn med Google…"}
        </p>
      </div>
    </div>
  );
}
