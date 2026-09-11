import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fleetApplicationApi, uploadApi, formatApiErrorDetail } from "../lib/api";
import { ChevronLeft, Upload, FileText, CheckCircle2, X } from "lucide-react";

const REQUIRED_DOCS = [
  { key: "firmaattest", label: "Firmaattest", desc: "Fra Brønnøysundregistrene, maks 3 mnd gammel" },
  { key: "loyvebevis", label: "Løyvebevis", desc: "Fylkeskommunens taxi-løyve" },
  { key: "vognkort", label: "Vognkort", desc: "For hver bil du vil ha på KJAPP" },
  { key: "forsikring", label: "Forsikringsbevis", desc: "Ansvars + kaskoforsikring, gyldig" },
  { key: "bank", label: "Bankkontobekreftelse", desc: "For utbetalinger" },
];

export default function ApplyFleet() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    company_name: "",
    org_number: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    bank_account: "",
    notes: "",
  });
  const [uploadToken, setUploadToken] = useState(null);
  const [docs, setDocs] = useState({});
  const [uploading, setUploading] = useState({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startDraft = async () => {
    setErr("");
    if (!form.company_name || !form.org_number || !form.contact_email || !form.contact_phone) {
      setErr("Fyll ut firmanavn, org.nr, e-post og telefon");
      return;
    }
    setSaving(true);
    try {
      const r = await fleetApplicationApi.createDraft(form);
      setUploadToken(r.upload_token);
      setStep(2);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke opprette søknad");
    } finally {
      setSaving(false);
    }
  };

  const onFileChange = async (docKey, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [docKey]: true }));
    setErr("");
    try {
      const r = await uploadApi.uploadPublic(file, uploadToken);
      setDocs((d) => ({ ...d, [docKey]: { path: r.storage_path, original_filename: r.original_filename, content_type: r.content_type } }));
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Opplasting feilet");
    } finally {
      setUploading((u) => ({ ...u, [docKey]: false }));
    }
  };

  const submit = async () => {
    setErr("");
    const missing = REQUIRED_DOCS.filter((d) => !docs[d.key]);
    if (missing.length) {
      setErr(`Mangler: ${missing.map((d) => d.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await fleetApplicationApi.submit(uploadToken, docs);
      setDone(true);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Innsending feilet");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="phone-shell grain min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full grid place-items-center mb-5" style={{ background: "linear-gradient(135deg, var(--accent), rgba(201,161,91,0.7))", boxShadow: "0 8px 40px var(--accent-glow)" }}>
          <CheckCircle2 size={36} style={{ color: "var(--accent-on)" }} />
        </div>
        <h1 className="font-display text-[28px]" style={{ color: "var(--text)" }}>Søknaden er sendt</h1>
        <p className="text-sm mt-3 max-w-[320px]" style={{ color: "var(--text-muted)" }}>
          Vi går gjennom dokumentene innen 3 virkedager og sender svar til <strong style={{ color: "var(--text)" }}>{form.contact_email}</strong>.
        </p>
        <button onClick={() => navigate("/")} className="btn-primary mt-8" data-testid="apply-done-home">Tilbake til forsiden</button>
      </div>
    );
  }

  return (
    <div className="phone-shell grain min-h-screen">
      <div className="px-6 pt-4 flex items-center gap-3">
        <button onClick={() => step === 2 ? setStep(1) : navigate("/")} className="w-10 h-10 -ml-2 grid place-items-center" style={{ color: "var(--text-muted)" }} data-testid="apply-back">
          <ChevronLeft size={22} />
        </button>
        <div className="text-[10px] tracking-[0.32em] uppercase" style={{ color: "var(--text-muted)" }}>KJAPP · Løyvehaver</div>
      </div>

      <div className="px-6 pt-4 pb-24">
        <h1 className="font-display text-[32px] leading-tight" style={{ color: "var(--text)" }}>
          {step === 1 ? "Bli løyvehaver på KJAPP" : "Last opp dokumentene"}
        </h1>
        <p className="text-sm mt-2 max-w-[400px]" style={{ color: "var(--text-muted)" }}>
          {step === 1
            ? "Fortell oss om firmaet ditt. Vi behandler alle søknader manuelt og gir svar innen 3 virkedager."
            : "Alle dokumenter må være i PDF eller bilde-format. Maks 8 MB per fil."}
        </p>

        {err && (
          <div className="mt-4 px-3 py-2.5 rounded-2xl text-sm" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.35)", color: "#e8c9b0" }}>
            {err}
          </div>
        )}

        {step === 1 ? (
          <div className="mt-6 space-y-3">
            <Field label="Firmanavn" value={form.company_name} onChange={(v) => update("company_name", v)} testid="apply-company-name" />
            <Field label="Organisasjonsnummer" value={form.org_number} onChange={(v) => update("org_number", v)} placeholder="9 siffer" testid="apply-org-number" />
            <Field label="Kontaktperson" value={form.contact_name} onChange={(v) => update("contact_name", v)} testid="apply-contact-name" />
            <Field label="E-post" type="email" value={form.contact_email} onChange={(v) => update("contact_email", v)} testid="apply-contact-email" />
            <Field label="Telefon" type="tel" value={form.contact_phone} onChange={(v) => update("contact_phone", v)} placeholder="+47 …" testid="apply-contact-phone" />
            <Field label="Bankkonto (for utbetalinger)" value={form.bank_account} onChange={(v) => update("bank_account", v)} placeholder="11 siffer" testid="apply-bank-account" />
            <div>
              <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>Kort notat (valgfritt)</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="input mt-1"
                rows={3}
                placeholder="Kort om flåten din, antall biler, sjåfører …"
                data-testid="apply-notes"
              />
            </div>

            <button onClick={startDraft} disabled={saving} className="btn-primary w-full mt-4" data-testid="apply-next">
              {saving ? "…" : "Fortsett til dokumenter"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {REQUIRED_DOCS.map((doc) => (
              <DocRow
                key={doc.key}
                doc={doc}
                file={docs[doc.key]}
                uploading={!!uploading[doc.key]}
                onFile={(f) => onFileChange(doc.key, f)}
                onRemove={() => setDocs((d) => { const n = { ...d }; delete n[doc.key]; return n; })}
              />
            ))}
            <button onClick={submit} disabled={saving} className="btn-primary w-full mt-4" data-testid="apply-submit">
              {saving ? "Sender inn…" : "Send inn søknad"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, testid }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input mt-1"
        data-testid={testid}
      />
    </div>
  );
}

function DocRow({ doc, file, uploading, onFile, onRemove }) {
  const inputRef = React.useRef();
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: file ? "rgba(201,161,91,0.16)" : "rgba(232,224,208,0.06)" }}>
          {file ? <CheckCircle2 size={18} style={{ color: "var(--accent)" }} /> : <FileText size={18} style={{ color: "var(--text-muted)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{doc.label}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{doc.desc}</div>
        </div>
        {file ? (
          <button onClick={onRemove} className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "rgba(232,224,208,0.06)", color: "var(--text-muted)" }} data-testid={`apply-doc-remove-${doc.key}`}>
            <X size={16} />
          </button>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3.5 py-2 rounded-xl text-[13px]"
            style={{ background: "rgba(201,161,91,0.14)", border: "1px solid rgba(201,161,91,0.28)", color: "var(--accent)" }}
            data-testid={`apply-doc-upload-${doc.key}`}
          >
            {uploading ? "…" : <><Upload size={13} className="inline mr-1" /> Last opp</>}
          </button>
        )}
      </div>
      {file && (
        <div className="mt-2 pl-13 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
          {file.original_filename}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
