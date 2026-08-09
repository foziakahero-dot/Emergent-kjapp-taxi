import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBar } from "../components/UIKit";
import { LogOut, Users, Car, MapPin, TrendingUp, LinkIcon, Copy, Check, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const TABS = [
  { id: "overview", label: "Oversikt" },
  { id: "drivers", label: "Sjåfører" },
  { id: "trips", label: "Turer" },
  { id: "users", label: "Brukere" },
  { id: "invites", label: "Invitasjoner" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="phone-shell grain">
      <StatusBar />
      <div className="px-4 pt-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-mint uppercase tracking-widest">Admin</div>
          <div className="font-display text-white text-lg tracking-tight">KJ<span className="text-mint">A</span>PP</div>
        </div>
        <button onClick={async () => { await logout(); navigate("/login"); }} className="text-[#7a8388] hover:text-red-400" data-testid="admin-logout">
          <LogOut size={18} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="mt-3 px-3 flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`admin-tab-${t.id}`}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-mint text-[#04120a] font-medium" : "bg-[#0e1113] text-[#a1a7ab] border border-line"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-10">
        {tab === "overview" && <Overview />}
        {tab === "drivers" && <Drivers />}
        {tab === "trips" && <Trips />}
        {tab === "users" && <UsersList />}
        {tab === "invites" && <Invites />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, testid }) {
  return (
    <div className="card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-mint" />
        <div className="text-[10px] text-[#7a8388] uppercase tracking-widest">{label}</div>
      </div>
      <div className="font-display text-2xl text-white">{value}</div>
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  useEffect(() => { adminApi.overview().then(setData); }, []);
  if (!data) return <div className="text-center py-10 text-[#7a8388]">Laster…</div>;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} label="Inntekt i dag" value={`${data.revenue_today} kr`} testid="stat-revenue" />
        <StatCard icon={MapPin} label="Turer i dag" value={data.trips_today} testid="stat-trips-today" />
        <StatCard icon={Users} label="Brukere" value={data.users} testid="stat-users" />
        <StatCard icon={Car} label="Sjåfører" value={data.drivers} testid="stat-drivers" />
      </div>
      {data.drivers_pending > 0 && (
        <div className="card p-4 border-mint/40" data-testid="pending-drivers-banner">
          <div className="text-[11px] text-mint uppercase tracking-widest">Godkjenning nødvendig</div>
          <div className="text-white text-sm mt-1">{data.drivers_pending} sjåfør{data.drivers_pending === 1 ? "" : "er"} venter</div>
        </div>
      )}
      <div className="card p-4">
        <div className="text-[11px] text-[#7a8388] uppercase tracking-widest">Totalt</div>
        <div className="text-white text-sm mt-1">{data.trips_total} turer siden lansering</div>
      </div>
    </motion.div>
  );
}

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = () => adminApi.drivers().then((r) => setDrivers(r.drivers));
  useEffect(() => { load(); }, []);

  const toggle = async (d) => {
    setBusy(d.id);
    await adminApi.approveDriver(d.id, !(d.approved !== false));
    await load();
    setBusy(null);
  };

  return (
    <div className="space-y-2">
      {drivers.length === 0 && <div className="text-center py-10 text-[#7a8388]">Ingen sjåfører ennå</div>}
      {drivers.map((d) => {
        const approved = d.approved !== false;
        return (
          <div key={d.id} className="card p-4" data-testid={`admin-driver-${d.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mint/10 grid place-items-center text-mint font-semibold">
                {(d.fullName || d.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm">{d.fullName}</div>
                <div className="text-[11px] text-[#7a8388]">{d.email} · {d.driver_id || "—"}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${approved ? "bg-mint/10 text-mint" : "bg-yellow-500/10 text-yellow-400"}`}>
                {approved ? "Godkjent" : "Venter"}
              </span>
            </div>
            <button
              onClick={() => toggle(d)}
              disabled={busy === d.id}
              data-testid={`admin-toggle-${d.id}`}
              className={`mt-3 w-full py-2 rounded-full text-sm font-medium ${approved ? "bg-[#141719] text-red-400 border border-line" : "bg-mint text-[#04120a]"}`}
            >
              {approved ? "Trekk godkjenning" : "Godkjenn sjåfør"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Trips() {
  const [trips, setTrips] = useState([]);
  useEffect(() => { adminApi.trips().then((r) => setTrips(r.trips)); }, []);
  return (
    <div className="space-y-2">
      {trips.length === 0 && <div className="text-center py-10 text-[#7a8388]">Ingen turer</div>}
      {trips.map((t) => (
        <div key={t.trip_id} className="card p-3" data-testid={`admin-trip-${t.trip_id}`}>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm truncate">{t.pickup_address} → {t.dropoff_address}</div>
              <div className="text-[11px] text-[#7a8388] mt-1">
                {new Date(t.created_at).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t.status}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{t.price} kr</div>
              <div className="text-[10px] text-[#7a8388]">{t.distance_km} km</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersList() {
  const [users, setUsers] = useState([]);
  useEffect(() => { adminApi.users().then((r) => setUsers(r.users)); }, []);
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="card p-3 flex items-center gap-3" data-testid={`admin-user-${u.id}`}>
          <div className="w-9 h-9 rounded-full bg-mint/10 grid place-items-center text-mint font-semibold text-sm">
            {(u.fullName || u.email)[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm truncate">{u.fullName}</div>
            <div className="text-[11px] text-[#7a8388] truncate">{u.email}</div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-[#a1a7ab]">{u.role}</span>
        </div>
      ))}
    </div>
  );
}

function Invites() {
  const [invites, setInvites] = useState([]);
  const [creating, setCreating] = useState(false);
  const [driverId, setDriverId] = useState("car-2");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(null);

  const load = () => adminApi.invites().then((r) => setInvites(r.invites));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      await adminApi.createInvite(driverId, note);
      await load();
      setNote("");
    } catch (e) {
      alert("Kunne ikke lage invitasjon: " + (e.response?.data?.detail || e.message));
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/driver-signup/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="text-white text-sm font-medium mb-3">Ny sjåfør-invitasjon</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input" data-testid="invite-car">
            {["car-1", "car-2", "car-3", "car-4", "car-5", "car-6", "car-7", "car-8"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Notat (valgfritt)" value={note} onChange={(e) => setNote(e.target.value)} data-testid="invite-note" />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary w-full text-sm" data-testid="invite-create">
          <LinkIcon size={14} className="inline mr-2" /> {creating ? "Oppretter…" : "Opprett invitasjons-lenke"}
        </button>
      </div>

      {invites.length === 0 && <div className="text-center py-6 text-[#7a8388] text-sm">Ingen invitasjoner ennå</div>}
      {invites.map((inv) => (
        <div key={inv.token} className="card p-3" data-testid={`invite-${inv.token}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${inv.used ? "bg-[#141719] text-[#7a8388]" : "bg-mint/10 text-mint"}`}>
              {inv.used ? "Brukt" : "Aktiv"}
            </span>
            <span className="text-[11px] text-[#7a8388]">{inv.driver_id}</span>
            <span className="text-[11px] text-[#7a8388] ml-auto">{new Date(inv.created_at).toLocaleDateString("nb-NO")}</span>
          </div>
          {inv.note && <div className="text-[12px] text-[#a1a7ab] mb-2">{inv.note}</div>}
          <button
            onClick={() => copyLink(inv.token)}
            className="w-full text-left px-3 py-2 rounded-lg bg-[#141719] border border-line text-mint text-[11px] font-mono flex items-center gap-2 hover:border-mint"
            data-testid={`copy-${inv.token}`}
          >
            {copied === inv.token ? <Check size={14} /> : <Copy size={14} />}
            <span className="truncate">{window.location.origin}/driver-signup/{inv.token}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
