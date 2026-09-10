import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { driverInviteApi, uploadApi, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ArrowRight, Car, ShieldCheck, Eye, EyeOff, Upload, CheckCircle2, FileText, User } from "lucide-react";

const DOC_TYPES = [
  { key: "drivers_license", label: "Førerkort", desc: "Bilde av gyldig førerkort (forside)" },
  { key: "taxi_license", label: "Kjøreseddel", desc: "Bilde av gyldig kjøreseddel (taxi)" },
  { key: "profile_photo", label: "Profilbilde", desc: "Tydelig ansiktsbilde (JPG/PNG)" },
];

export default function DriverSignup() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [docs, setDocs] = useState({}); // {drivers_license: {path,...}}
  const [uploading, setUploading] = useState({});
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

  const nextStep = () => {
    setErr("");
    if (!form.fullName || !form.email || !form.phone || form.password.length < 6) {
      setErr("Fyll ut alle feltene (passord: minst 6 tegn)");
      return;
    }
    setStep(2);
  };

  const onFile = async (docType, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [docType]: true }));
    setErr("");
    try {
      const r = await uploadApi.uploadDriverDoc(file, token, docType);
      setDocs((d) => ({ ...d, [docType]: r }));
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Opplasting feilet");
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  };

  const submit = async () => {
    setErr("");
    const missing = DOC_TYPES.filter((d) => !docs[d.key]);
    if (missing.length) {
      setErr(`Mangler: ${missing.map((d) => d.label).join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await driverInviteApi.accept({
        token,
        ...form,
        drivers_license_path: docs.drivers_license?.storage_path,
        taxi_license_path: docs.taxi_license?.storage_path,
        profile_photo_path: docs.profile_photo?.storage_path,
      });
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
    return <div className="phone-shell grain flex items-center justify-center"><div className="orb orb-tiny" /></div>;
  }

  if (!invite) {
    return (
      <div className="phone-shell grain flex flex-col">
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full grid place-items-center" style={{ background: "rgba(215,106,90,0.14)" }}>
            <ShieldCheck size={22} style={{ color: "#e39e5c" }} />
          </div>
          <h1 className="mt-4 text-lg" style={{ color: "var(--text)" }}>Ugyldig invitasjon</h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{err || "Denne lenken finnes ikke, er brukt eller utløpt."}</p>
          <button onClick={() => navigate("/")} className="btn-primary mt-6" data-testid="dsignup-home">Til forsiden</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="phone-shell grain flex flex-col">
        <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full grid place-items-center" style={{ background: "linear-gradient(135deg, var(--accent), rgba(201,161,91,0.7))", boxShadow: "0 8px 40px var(--accent-glow)" }}>
            <CheckCircle2 size={30} style={{ color: "var(--accent-on)" }} />
          </div>
          <h1 className="font-display mt-4 text-[24px]" style={{ color: "var(--text)" }}>Registrering mottatt</h1>
          <p className="text-sm mt-2 max-w-[300px]" style={{ color: "var(--text-muted)" }}>
            Kontoen din er registrert. Superadmin ser gjennom dokumentene og godkjenner deg. Du får en e-post når du er godkjent.
          </p>
          <button onClick={() => navigate("/driver/login")} className="btn-ghost mt-6" data-testid="dsignup-continue">Til innlogging</button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-shell grain flex flex-col">
      <div className="px-8 pt-4">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>Sjåfør-registrering · Steg {step}/2</div>
        <h1 className="font-display text-[24px] tracking-tight mt-1" style={{ color: "var(--text)" }}>{step === 1 ? "Velkommen til flåten" : "Last opp dokumenter"}</h1>
        {step === 1 && (
          <div className="mt-4 p-4 rounded-2xl flex items-center gap-3" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}>
            <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
              <Car size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Bil tildelt</div>
              <div className="text-sm" style={{ color: "var(--text)" }}>{invite.car} · {invite.plate}</div>
            </div>
          </div>
        )}
      </div>

      {step === 1 ? (
        <div className="px-8 pt-6 space-y-4 flex-1">
          <input className="input" placeholder="Fullt navn" value={form.fullName} onChange={change("fullName")} data-testid="dsignup-name" />
          <input className="input" type="email" placeholder="E-post" value={form.email} onChange={change("email")} data-testid="dsignup-email" />
          <input className="input" placeholder="Telefonnummer" value={form.phone} onChange={change("phone")} data-testid="dsignup-phone" />
          <div className="relative">
            <input className="input pr-12" type={showPw ? "text" : "password"} placeholder="Passord (min. 6 tegn)" value={form.password} onChange={change("password")} data-testid="dsignup-password" />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} onClick={() => setShowPw((v) => !v)}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {err && <div className="text-sm rounded-xl px-4 py-3" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.30)", color: "#e8c9b0" }} data-testid="dsignup-error">{err}</div>}

          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Ved å registrere deg godtar du KJAPPs{" "}
            <Link to="/terms" style={{ color: "var(--accent)" }}>sjåfør-vilkår</Link> og{" "}
            <Link to="/privacy" style={{ color: "var(--accent)" }}>personvernerklæring</Link>.
          </p>

          <div className="pt-2 flex justify-center pb-10">
            <button onClick={nextStep} data-testid="dsignup-next" className="btn-primary flex items-center gap-2">
              Neste — last opp dokumenter <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-8 pt-6 flex-1 space-y-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Vi trenger bilde av førerkort, kjøreseddel og et profilbilde før superadmin kan godkjenne kontoen din.
          </p>
          {DOC_TYPES.map((doc) => (
            <DocRow
              key={doc.key}
              doc={doc}
              file={docs[doc.key]}
              uploading={!!uploading[doc.key]}
              onFile={(f) => onFile(doc.key, f)}
              onRemove={() => setDocs((d) => { const n = { ...d }; delete n[doc.key]; return n; })}
            />
          ))}
          {err && <div className="text-sm rounded-xl px-4 py-3" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.30)", color: "#e8c9b0" }} data-testid="dsignup-error">{err}</div>}
          <div className="pt-2 flex flex-col items-stretch gap-2 pb-10">
            <button onClick={submit} disabled={submitting} className="btn-primary flex items-center justify-center gap-2" data-testid="dsignup-submit">
              {submitting ? <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-on)", borderTopColor: "transparent" }} /> : <>Send til godkjenning <ArrowRight size={18} /></>}
            </button>
            <button onClick={() => setStep(1)} className="text-sm underline underline-offset-4" style={{ color: "var(--text-muted)" }}>Tilbake</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, file, uploading, onFile, onRemove }) {
  const inputRef = React.useRef();
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: file ? "rgba(201,161,91,0.16)" : "rgba(232,224,208,0.06)" }}>
          {file ? <CheckCircle2 size={18} style={{ color: "var(--accent)" }} /> : (doc.key === "profile_photo" ? <User size={18} style={{ color: "var(--text-muted)" }} /> : <FileText size={18} style={{ color: "var(--text-muted)" }} />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{doc.label}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{doc.desc}</div>
        </div>
        {file ? (
          <button onClick={onRemove} className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(232,224,208,0.06)", color: "var(--text-muted)" }} data-testid={`dsignup-doc-remove-${doc.key}`}>✕</button>
        ) : (
          <button onClick={() => inputRef.current?.click()} disabled={uploading} className="px-3.5 py-2 rounded-xl text-[13px]" style={{ background: "rgba(201,161,91,0.14)", border: "1px solid rgba(201,161,91,0.28)", color: "var(--accent)" }} data-testid={`dsignup-doc-upload-${doc.key}`}>
            {uploading ? "…" : <><Upload size={13} className="inline mr-1" /> Last opp</>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
