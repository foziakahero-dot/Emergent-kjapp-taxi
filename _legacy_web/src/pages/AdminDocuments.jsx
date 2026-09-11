import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { Search, FileText, Loader2, Eye, Image as ImageIcon } from "lucide-react";

const SCOPE_LABEL = {
  firmaattest: "Firmaattest", loyvebevis: "Løyvebevis", vognkort: "Vognkort",
  forsikring: "Forsikring", bank: "Bankbekreftelse",
  drivers_license: "Førerkort", taxi_license: "Kjøreseddel", profile_photo: "Profilbilde",
};

function fmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}

export default function AdminDocuments() {
  const [scope, setScope] = useState("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    let alive = true;
    adminApi.documents({ scope, q: q || undefined })
      .then((r) => { if (alive) { setData(r); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.response?.data?.detail || "Kunne ikke laste"); });
    return () => { alive = false; };
  }, [scope, q]);

  const openDoc = async (doc) => {
    setOpening(doc.id);
    try {
      const blob = await adminApi.fileBlob(doc.storage_path);
      const url = URL.createObjectURL(new Blob([blob], { type: doc.content_type }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setErr("Kunne ikke åpne dokumentet"); }
    finally { setOpening(null); }
  };

  const scopes = ["all", ...(data?.scopes || [])];

  return (
    <div className="space-y-4" data-testid="admin-documents">
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
        {scopes.map((s) => (
          <button key={s} onClick={() => setScope(s)} data-testid={`docs-scope-${s}`}
            className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap"
            style={{
              background: scope === s ? "rgba(203,163,101,0.14)" : "rgba(244,244,240,0.03)",
              color: scope === s ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${scope === s ? "rgba(203,163,101,0.28)" : "var(--line)"}`,
            }}>{s === "all" ? "Alle" : SCOPE_LABEL[s] || s}</button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }}>
        <Search size={14} style={{ color: "var(--text-muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk etter filnavn…"
          data-testid="docs-search" className="bg-transparent flex-1 text-[13px] outline-none" style={{ color: "var(--text)" }} />
      </div>

      {err && <div className="card p-4 text-center text-[13px]" data-testid="docs-error">{err}</div>}
      {!data ? (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }} data-testid="docs-loading"><Loader2 size={16} className="animate-spin" /> Laster…</div>
      ) : data.documents.length === 0 ? (
        <div className="card p-8 text-center" data-testid="docs-empty">
          <FileText size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <div className="text-[14px]" style={{ color: "var(--text)" }}>Ingen dokumenter</div>
        </div>
      ) : (
        <div className="space-y-2">
          {data.documents.map((d) => {
            const isImage = (d.content_type || "").startsWith("image/");
            return (
              <div key={d.id} className="flex items-center gap-4 p-3.5 rounded-2xl" style={{ background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" }} data-testid={`doc-row-${d.id}`}>
                <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {isImage ? <ImageIcon size={15} /> : <FileText size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] truncate" style={{ color: "var(--text)" }}>{d.filename || "Uten navn"}</span>
                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(203,163,101,0.12)", color: "var(--accent)" }}>{SCOPE_LABEL[d.scope] || d.scope}</span>
                  </div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {d.owner_name || d.owner_email || "Ukjent eier"} · {fmtSize(d.size)} · {d.created_at ? new Date(d.created_at).toLocaleDateString("no-NO") : "—"}
                  </div>
                </div>
                <button onClick={() => openDoc(d)} disabled={opening === d.id} data-testid={`doc-open-${d.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] shrink-0"
                  style={{ background: "rgba(244,244,240,0.04)", color: "var(--text)", border: "1px solid var(--line)" }}>
                  {opening === d.id ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Åpne
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
