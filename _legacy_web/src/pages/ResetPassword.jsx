import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState("checking"); // checking | invalid | form | done
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/auth/reset-password/${token}`)
      .then(() => setState("form"))
      .catch(() => setState("invalid"));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) { setErr("Passord må ha minst 6 tegn"); return; }
    if (pw !== pw2) { setErr("Passordene er ikke like"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      setState("done");
    } catch (e2) {
      const d = e2.response?.data?.detail;
      setErr(typeof d === "string" ? d : "Noe gikk galt. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-shell grain flex flex-col">
      <div className="px-6 pt-2 flex items-center">
        <button onClick={() => navigate("/login")} className="w-10 h-10 -ml-2 grid place-items-center text-[#7a827a]" data-testid="reset-back">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-8 pt-4 flex-1">
        {state === "checking" && (
          <div className="pt-16 flex items-center justify-center gap-2 text-[#7a827a] text-sm" data-testid="reset-checking">
            <Loader2 size={16} className="animate-spin" /> Sjekker lenken…
          </div>
        )}

        {state === "invalid" && (
          <div className="pt-10 text-center" data-testid="reset-invalid">
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-5" style={{ background: "rgba(215,106,90,0.12)", color: "#d76a5a" }}>
              <AlertCircle size={26} />
            </div>
            <h1 className="font-display text-[26px] tracking-tight text-white">Lenken virker ikke</h1>
            <p className="text-[#7a827a] text-sm mt-3">Lenken er ugyldig eller utløpt. Be om en ny tilbakestillingslenke.</p>
            <button
              onClick={() => navigate("/forgot-password")}
              data-testid="reset-request-new"
              className="mt-8 px-6 py-3 rounded-full text-[14px] font-medium"
              style={{ background: "var(--accent)", color: "#0B1013" }}
            >
              Be om ny lenke
            </button>
          </div>
        )}

        {state === "form" && (
          <>
            <h1 className="font-display text-[28px] tracking-tight text-white">Velg nytt passord</h1>
            <p className="text-[#7a827a] text-sm mt-2">Minst 6 tegn. Du logges inn med det nye passordet etterpå.</p>
            <form onSubmit={submit} className="mt-10 space-y-4">
              <div className="relative">
                <input
                  className="input pr-12"
                  type={showPw ? "text" : "password"}
                  placeholder="Nytt passord"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  data-testid="reset-password"
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a827a]" onClick={() => setShowPw((v) => !v)} data-testid="reset-toggle-pw">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <input
                className="input"
                type={showPw ? "text" : "password"}
                placeholder="Gjenta nytt passord"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                data-testid="reset-password-confirm"
                autoComplete="new-password"
                required
              />
              {err && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" data-testid="reset-error">{err}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="reset-submit"
                className="w-full py-4 rounded-2xl text-[15px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#0B1013" }}
              >
                {loading ? "Lagrer…" : "Lagre nytt passord"}
              </button>
            </form>
          </>
        )}

        {state === "done" && (
          <div className="pt-10 text-center" data-testid="reset-success">
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-5" style={{ background: "rgba(47,224,140,0.12)", color: "#2fe08c" }}>
              <CheckCircle2 size={26} />
            </div>
            <h1 className="font-display text-[26px] tracking-tight text-white">Passordet er endret</h1>
            <p className="text-[#7a827a] text-sm mt-3">Du kan nå logge inn med det nye passordet ditt.</p>
            <button
              onClick={() => navigate("/login")}
              data-testid="reset-to-login"
              className="mt-8 px-6 py-3 rounded-full text-[14px] font-medium"
              style={{ background: "var(--accent)", color: "#0B1013" }}
            >
              Logg inn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
