import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { superadminApi, uploadApi, formatApiErrorDetail } from "../lib/api";
import { ChevronLeft, FileText, CheckCircle2, XCircle, ExternalLink, Building2, Mail, Phone, Landmark } from "lucide-react";

const DOC_LABELS = {
  firmaattest: "Firmaattest",
  loyvebevis: "Løyvebevis",
  vognkort: "Vognkort",
  forsikring: "Forsikringsbevis",
  bank: "Bankkonto",
};

export default function SuperadminApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [err, setErr] = useState("");
  const [decision, setDecision] = useState(null); // 'approve' | 'reject'
  const [reviewNotes, setReviewNotes] = useState("");
  const [commissionRate, setCommissionRate] = useState(0.20);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLabel, setPreviewLabel] = useState("");

  useEffect(() => {
    superadminApi.getApplication(id)
      .then(setApp)
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail) || "Fant ikke søknad"));
  }, [id]);

  const openDoc = async (docKey) => {
    const doc = app.documents?.[docKey];
    if (!doc?.path) return;
    try {
      const url = await uploadApi.fetchAsBlobUrl(doc.path);
      setPreviewUrl(url);
      setPreviewLabel(DOC_LABELS[docKey] || docKey);
    } catch (e) {
      alert("Kunne ikke åpne dokumentet");
    }
  };

  const submitDecision = async () => {
    setBusy(true);
    setErr("");
    try {
      if (decision === "approve") {
        await superadminApi.approve(id, { review_notes: reviewNotes, commission_rate: commissionRate });
      } else {
        await superadminApi.reject(id, { review_notes: reviewNotes });
      }
      navigate("/loyver");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Handling feilet");
    } finally {
      setBusy(false);
    }
  };

  if (!app && !err) return <div className="min-h-screen grid place-items-center"><div className="orb orb-small" /></div>;

  return (
    <div className="min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 pt-10 pb-16">
        <button onClick={() => navigate("/loyver")} className="flex items-center gap-1 text-sm mb-6" style={{ color: "var(--text-muted)" }} data-testid="sad-back">
          <ChevronLeft size={16} /> Tilbake
        </button>

        {err && <div className="mb-6 px-4 py-3 rounded-2xl text-sm" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.35)", color: "#e8c9b0" }}>{err}</div>}

        {app && (
          <>
            <div className="flex items-start gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl grid place-items-center" style={{ background: "rgba(201,161,91,0.14)" }}>
                <Building2 size={22} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.32em] uppercase" style={{ color: "var(--accent)" }}>Søknad</div>
                <h1 className="font-display text-[32px] leading-tight mt-1" style={{ color: "var(--text)" }}>{app.company_name}</h1>
                <div className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>org.nr {app.org_number} · innsendt {new Date(app.submitted_at || app.created_at).toLocaleString("nb-NO")}</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: "rgba(201,161,91,0.14)", color: "var(--accent)" }}>{app.status}</div>
            </div>

            {/* Contact block */}
            <div className="grid sm:grid-cols-3 gap-3 mb-8">
              <InfoCell icon={<Mail size={14} />} label="Kontakt" value={<><div>{app.contact_name}</div><a href={`mailto:${app.contact_email}`} className="text-[12px]" style={{ color: "var(--accent)" }}>{app.contact_email}</a></>} />
              <InfoCell icon={<Phone size={14} />} label="Telefon" value={<a href={`tel:${app.contact_phone}`} style={{ color: "var(--text)" }}>{app.contact_phone}</a>} />
              <InfoCell icon={<Landmark size={14} />} label="Bankkonto" value={app.bank_account || "—"} />
            </div>

            {app.notes && (
              <div className="mb-8 p-4 rounded-2xl" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Notat fra søker</div>
                <div className="text-sm" style={{ color: "var(--text)" }}>{app.notes}</div>
              </div>
            )}

            {/* Documents */}
            <div className="text-[10px] tracking-widest uppercase mb-3" style={{ color: "var(--text-muted)" }}>Dokumenter</div>
            <div className="grid sm:grid-cols-2 gap-3 mb-10">
              {Object.entries(DOC_LABELS).map(([k, label]) => {
                const doc = app.documents?.[k];
                return (
                  <button
                    key={k}
                    onClick={() => doc && openDoc(k)}
                    disabled={!doc}
                    className="p-4 rounded-2xl flex items-center gap-3 text-left transition-colors"
                    style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)", opacity: doc ? 1 : 0.5 }}
                    data-testid={`sad-doc-${k}`}
                  >
                    <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "rgba(201,161,91,0.12)" }}>
                      <FileText size={16} style={{ color: "var(--accent)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                      <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{doc?.original_filename || "Ikke lastet opp"}</div>
                    </div>
                    {doc && <ExternalLink size={14} style={{ color: "var(--text-muted)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Decision */}
            {app.status === "pending" ? (
              <div className="p-4 rounded-2xl" style={{ background: "rgba(232,224,208,0.03)", border: "1px solid rgba(232,224,208,0.10)" }}>
                <div className="font-display text-[22px] mb-3" style={{ color: "var(--text)" }}>Beslutning</div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setDecision("approve")}
                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
                    style={{
                      background: decision === "approve" ? "rgba(201,161,91,0.18)" : "rgba(232,224,208,0.04)",
                      border: `1px solid ${decision === "approve" ? "var(--accent)" : "rgba(232,224,208,0.10)"}`,
                      color: decision === "approve" ? "var(--accent)" : "var(--text)",
                    }}
                    data-testid="sad-choose-approve"
                  >
                    <CheckCircle2 size={16} /> Godkjenn
                  </button>
                  <button
                    onClick={() => setDecision("reject")}
                    className="flex-1 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
                    style={{
                      background: decision === "reject" ? "rgba(215,106,90,0.18)" : "rgba(232,224,208,0.04)",
                      border: `1px solid ${decision === "reject" ? "#d76a5a" : "rgba(232,224,208,0.10)"}`,
                      color: decision === "reject" ? "#e8c9b0" : "var(--text)",
                    }}
                    data-testid="sad-choose-reject"
                  >
                    <XCircle size={16} /> Avslå
                  </button>
                </div>
                {decision === "approve" && (
                  <div className="mb-3">
                    <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>KJAPP provisjon (%)</label>
                    <input
                      type="number"
                      value={Math.round(commissionRate * 100)}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value) / 100)}
                      className="input mt-1"
                      min="0" max="50" step="1"
                      data-testid="sad-commission"
                    />
                  </div>
                )}
                <label className="text-[11px] uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>Notat til søker (valgfritt)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="input mt-1"
                  rows={3}
                  placeholder="Kort begrunnelse …"
                  data-testid="sad-notes"
                />
                <button
                  onClick={submitDecision}
                  disabled={!decision || busy}
                  className="btn-primary w-full mt-4"
                  data-testid="sad-submit"
                >
                  {busy ? "…" : decision === "reject" ? "Send avslag" : "Godkjenn og opprett flåte"}
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-2xl" style={{ background: "rgba(232,224,208,0.03)", border: "1px solid rgba(232,224,208,0.10)" }}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Beslutning</div>
                <div className="text-sm mb-2" style={{ color: "var(--text)" }}>{app.status === "approved" ? "Godkjent" : "Avslått"} {app.reviewed_at ? new Date(app.reviewed_at).toLocaleString("nb-NO") : ""}</div>
                {app.review_notes && <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>{app.review_notes}</div>}
                {app.fleet_id && (
                  <div className="text-[12px] mt-2" style={{ color: "var(--accent)" }}>Flåte-ID: {app.fleet_id}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[1000] grid place-items-center px-4 py-8" style={{ background: "rgba(4,8,10,0.9)", backdropFilter: "blur(10px)" }} onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>
          <div className="w-full max-w-[900px] h-[85vh] rounded-2xl overflow-hidden" style={{ background: "rgba(12,18,22,0.98)", border: "1px solid rgba(232,224,208,0.10)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(232,224,208,0.10)" }}>
              <div className="font-display text-[18px]" style={{ color: "var(--text)" }}>{previewLabel}</div>
              <button onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="text-sm" style={{ color: "var(--text-muted)" }} data-testid="sad-preview-close">Lukk</button>
            </div>
            <iframe src={previewUrl} title={previewLabel} className="w-full h-full" style={{ background: "white" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({ icon, label, value }) {
  return (
    <div className="p-3 rounded-2xl" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
        {icon} {label}
      </div>
      <div className="text-sm" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}
