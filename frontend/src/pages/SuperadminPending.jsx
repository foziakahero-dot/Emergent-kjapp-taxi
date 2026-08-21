import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superadminApi, adminApi, uploadApi, formatApiErrorDetail } from "../lib/api";
import { ChevronLeft, CheckCircle2, XCircle, User, FileText, Building2 } from "lucide-react";

export default function SuperadminPending() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = () => {
    setLoading(true);
    superadminApi.pendingDrivers()
      .then((r) => setDrivers(r.drivers || []))
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approve = async (driver) => {
    setBusy(driver.id);
    try {
      await adminApi.approveDriver(driver.id, true);
      load();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Godkjenning feilet");
    } finally { setBusy(null); }
  };

  const reject = async (driver) => {
    if (!window.confirm(`Avvis sjåfør ${driver.fullName}?`)) return;
    setBusy(driver.id);
    try {
      await adminApi.approveDriver(driver.id, false);
      load();
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Feilet");
    } finally { setBusy(null); }
  };

  const openDoc = async (path, label) => {
    try {
      const url = await uploadApi.fetchAsBlobUrl(path);
      setPreview({ url, label });
    } catch { alert("Kunne ikke åpne dokumentet"); }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <button onClick={() => navigate("/loyver")} className="flex items-center gap-1 text-sm mb-6" style={{ color: "var(--text-muted)" }} data-testid="sap-back">
          <ChevronLeft size={16} /> Tilbake til søknader
        </button>

        <div className="text-[10px] tracking-[0.32em] uppercase" style={{ color: "var(--accent)" }}>Sjåfører · venter på godkjenning</div>
        <h1 className="font-display text-[36px] leading-tight mt-1 mb-8" style={{ color: "var(--text)" }}>Nye sjåfører</h1>

        {err && <div className="mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: "rgba(215,106,90,0.14)", border: "1px solid rgba(215,106,90,0.35)", color: "#e8c9b0" }}>{err}</div>}

        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Laster …</div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Ingen sjåfører venter på godkjenning akkurat nå.</div>
        ) : (
          <div className="space-y-3">
            {drivers.map((d) => (
              <div key={d.id} className="p-5 rounded-2xl" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }} data-testid={`sap-driver-${d.id}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl grid place-items-center shrink-0" style={{ background: "rgba(201,161,91,0.14)" }}>
                    <User size={18} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium" style={{ color: "var(--text)" }}>{d.fullName}</div>
                    <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {d.email} · {d.phone || "—"}
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Bil: {d.car || "—"} · Plate: {d.plate || "—"}
                    </div>
                    {d.fleet_name && (
                      <div className="text-[11px] mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "rgba(201,161,91,0.14)", color: "var(--accent)" }}>
                        <Building2 size={11} /> {d.fleet_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <DocButton path={d.drivers_license_path} label="Førerkort" onClick={openDoc} testid={`sap-fk-${d.id}`} />
                  <DocButton path={d.taxi_license_path} label="Kjøreseddel" onClick={openDoc} testid={`sap-ks-${d.id}`} />
                  <DocButton path={d.profile_photo_path} label="Profilbilde" onClick={openDoc} testid={`sap-pp-${d.id}`} />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => reject(d)}
                    disabled={busy === d.id}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
                    style={{ background: "rgba(215,106,90,0.10)", border: "1px solid rgba(215,106,90,0.30)", color: "#e8c9b0" }}
                    data-testid={`sap-reject-${d.id}`}
                  >
                    <XCircle size={14} /> Avvis
                  </button>
                  <button
                    onClick={() => approve(d)}
                    disabled={busy === d.id}
                    className="flex-1 btn-primary text-sm"
                    style={{ padding: "10px 16px" }}
                    data-testid={`sap-approve-${d.id}`}
                  >
                    <CheckCircle2 size={14} className="inline mr-1" /> Godkjenn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[1000] grid place-items-center px-4 py-8" style={{ background: "rgba(4,8,10,0.9)", backdropFilter: "blur(10px)" }} onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="w-full max-w-[720px] h-[85vh] rounded-2xl overflow-hidden" style={{ background: "rgba(12,18,22,0.98)", border: "1px solid rgba(232,224,208,0.10)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(232,224,208,0.10)" }}>
              <div className="font-display text-[18px]" style={{ color: "var(--text)" }}>{preview.label}</div>
              <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="text-sm" style={{ color: "var(--text-muted)" }} data-testid="sap-preview-close">Lukk</button>
            </div>
            <iframe src={preview.url} title={preview.label} className="w-full h-full" style={{ background: "white" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function DocButton({ path, label, onClick, testid }) {
  return (
    <button
      onClick={() => path && onClick(path, label)}
      disabled={!path}
      className="p-2.5 rounded-xl flex flex-col items-center gap-1 transition-colors"
      style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)", opacity: path ? 1 : 0.4 }}
      data-testid={testid}
    >
      <FileText size={14} style={{ color: path ? "var(--accent)" : "var(--text-muted)" }} />
      <span className="text-[11px]" style={{ color: "var(--text)" }}>{label}</span>
    </button>
  );
}
