import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Orb } from "../components/UIKit";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { googleSession } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = location.hash || window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session_id = params.get("session_id");
    if (!session_id) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        const u = await googleSession(session_id);
        // clean hash
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate(u.role === "driver" ? "/driver" : u.role === "admin" ? "/admin" : "/app", { replace: true });
      } catch (e) {
        navigate("/login?err=google", { replace: true });
      }
    })();
  }, [location.hash, googleSession, navigate]);

  return (
    <div className="phone-shell grain flex flex-col items-center justify-center">
      <Orb size="default" />
      <div className="mt-8 text-white text-sm">Logger deg inn med Google…</div>
    </div>
  );
}
