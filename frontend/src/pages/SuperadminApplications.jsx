import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superadminApi, authApi } from "../lib/api";
import { LogOut, Users, FileText, Clock, CheckCircle2, XCircle, RefreshCw, Building2 } from "lucide-react";

const STATUS_META = {
  pending: { label: "Venter på gjennomgang", color: "#e39e5c", bg: "rgba(215,106,90,0.14)" },
  approved: { label: "Godkjent", color: "#8ac48f", bg: "rgba(138,196,143,0.14)" },
  rejected: { label: "Avslått", color: "#d76a5a", bg: "rgba(215,106,90,0.14)" },
};

export default function SuperadminApplications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("pending");
  const [apps, setApps] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      superadminApi.listApplications(tab),
      superadminApi.pendingDrivers().catch(() => ({ drivers: [] })),
    ]).then(([apps, pd]) => {
      setApps(apps.applications || []);
      setPending(pd.drivers || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab]);

  const logout = async () => {
    await authApi.logout().catch(() => {});
    localStorage.removeItem("kjapp_token");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-[10px] tracking-[0.32em] uppercase" style={{ color: "var(--accent)" }}>Superadmin</div>
            <h1 className="font-display text-[36px] leading-tight mt-1" style={{ color: "var(--text)" }}>Løyvehaver-panelet</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Vurder søknader, godkjenn sjåfører, koble til flåter</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }} data-testid="sa-refresh">
              <RefreshCw size={16} style={{ color: "var(--text-muted)" }} />
            </button>
            <button onClick={logout} className="w-11 h-11 rounded-full grid place-items-center" style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }} data-testid="sa-logout">
              <LogOut size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <StatCard icon={<Clock size={16} />} label="Nye søknader" value={apps.filter(a => a.status === "pending").length} onClick={() => setTab("pending")} testid="sa-stat-pending" />
          <StatCard icon={<Building2 size={16} />} label="Godkjente flåter" value={apps.filter(a => a.status === "approved").length} onClick={() => setTab("approved")} testid="sa-stat-approved" />
          <StatCard icon={<Users size={16} />} label="Sjåfører som venter" value={pending.length} onClick={() => navigate("/loyver/pending-drivers")} testid="sa-stat-pending-drivers" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {["pending", "approved", "rejected"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-full text-[13px] transition-colors"
              style={{
                background: tab === t ? "rgba(201,161,91,0.16)" : "transparent",
                border: `1px solid ${tab === t ? "rgba(201,161,91,0.32)" : "rgba(232,224,208,0.10)"}`,
                color: tab === t ? "var(--accent)" : "var(--text-muted)",
              }}
              data-testid={`sa-tab-${t}`}
            >
              {STATUS_META[t].label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Laster …</div>
          ) : apps.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--text-muted)" }}>Ingen søknader i denne kategorien.</div>
          ) : apps.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/loyver/applications/${a.id}`)}
              className="w-full p-4 rounded-2xl flex items-center gap-4 text-left transition-colors"
              style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}
              data-testid={`sa-app-${a.id}`}
            >
              <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: "rgba(201,161,91,0.12)" }}>
                <Building2 size={18} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate" style={{ color: "var(--text)" }}>{a.company_name}</div>
                <div className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>
                  org.nr {a.org_number} · {a.contact_email}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full inline-block" style={{ background: STATUS_META[a.status]?.bg, color: STATUS_META[a.status]?.color }}>
                  {STATUS_META[a.status]?.label || a.status}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {a.documents_count} dok
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-2xl text-left transition-colors"
      style={{ background: "rgba(232,224,208,0.04)", border: "1px solid rgba(232,224,208,0.10)" }}
      data-testid={testid}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: "var(--accent)" }}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-display text-[32px] leading-none" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </button>
  );
}
