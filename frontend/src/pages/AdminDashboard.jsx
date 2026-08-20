import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, adminFleetsApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { StatusBar } from "../components/UIKit";
import { LogOut, Users, Car, MapPin, TrendingUp, LinkIcon, Copy, Check, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const TABS = [
  { id: "overview", label: "Oversikt" },
  { id: "drivers", label: "Sjåfører" },
  { id: "fleets", label: "Flåter" },
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
      
      <div className="px-4 pt-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-mint uppercase tracking-widest">Admin</div>
          <div className="font-display text-white text-lg tracking-tight">KJ<span className="text-mint">A</span>PP</div>
        </div>
        <button onClick={async () => { await logout(); navigate("/login"); }} className="text-[#7a827a] hover:text-red-400" data-testid="admin-logout">
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
              tab === t.id ? "bg-mint text-[#04120a] font-medium" : "bg-[#131a1f] text-[#a8b0a8] border border-line"
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
        {tab === "fleets" && <Fleets />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, testid }) {
  return (
    <div className="card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-mint" />
        <div className="text-[10px] text-[#7a827a] uppercase tracking-widest">{label}</div>
      </div>
      <div className="font-display text-2xl text-white">{value}</div>
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  useEffect(() => { adminApi.overview().then(setData); }, []);
  if (!data) return <div className="text-center py-10 text-[#7a827a]">Laster…</div>;
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
        <div className="text-[11px] text-[#7a827a] uppercase tracking-widest">Totalt</div>
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
      {drivers.length === 0 && <div className="text-center py-10 text-[#7a827a]">Ingen sjåfører ennå</div>}
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
                <div className="text-[11px] text-[#7a827a]">{d.email} · {d.plate || d.car || "—"}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${approved ? "bg-mint/10 text-mint" : "bg-yellow-500/10 text-yellow-400"}`}>
                {approved ? "Godkjent" : "Venter"}
              </span>
            </div>
            <button
              onClick={() => toggle(d)}
              disabled={busy === d.id}
              data-testid={`admin-toggle-${d.id}`}
              className={`mt-3 w-full py-2 rounded-full text-sm font-medium ${approved ? "bg-[#17222a] text-red-400 border border-line" : "bg-mint text-[#04120a]"}`}
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
      {trips.length === 0 && <div className="text-center py-10 text-[#7a827a]">Ingen turer</div>}
      {trips.map((t) => (
        <div key={t.trip_id} className="card p-3" data-testid={`admin-trip-${t.trip_id}`}>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm truncate">{t.pickup_address} → {t.dropoff_address}</div>
              <div className="text-[11px] text-[#7a827a] mt-1">
                {new Date(t.created_at).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t.status}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-semibold text-sm">{t.price} kr</div>
              <div className="text-[10px] text-[#7a827a]">{t.distance_km} km</div>
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
            <div className="text-[11px] text-[#7a827a] truncate">{u.email}</div>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-[#a8b0a8]">{u.role}</span>
        </div>
      ))}
    </div>
  );
}

function Invites() {
  const [invites, setInvites] = useState([]);
  const [creating, setCreating] = useState(false);
  const [car, setCar] = useState("Tesla Model Y");
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState("ai-first");
  const [inviteEmail, setInviteEmail] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(null);

  const load = () => adminApi.invites().then((r) => setInvites(r.invites));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!plate.trim()) { alert("Skilt er påkrevd"); return; }
    setCreating(true);
    try {
      const res = await adminApi.createInvite({ car, plate, vehicle_type: vehicleType, note, email: inviteEmail });
      await load();
      setNote("");
      setInviteEmail("");
      setPlate("");
      if (res?.email_sent === false && inviteEmail) {
        alert("Invitasjon opprettet, men e-post ble ikke sendt (SendGrid ikke konfigurert). Kopier lenken manuelt.");
      }
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
        <div className="space-y-2 mb-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Bilmerke" value={car} onChange={(e) => setCar(e.target.value)} data-testid="invite-car" />
            <input className="input" placeholder="Skilt (f.eks. EL12345)" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} data-testid="invite-plate" />
          </div>
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="input" data-testid="invite-vtype">
            <option value="enkelt">Enkelt (beste pris)</option>
            <option value="ai-first">Standard</option>
            <option value="trygg">Trygg / XL (7 seter)</option>
            <option value="premium">Premium (business)</option>
          </select>
          <input className="input" placeholder="Notat (valgfritt)" value={note} onChange={(e) => setNote(e.target.value)} data-testid="invite-note" />
          <input className="input" placeholder="E-post til sjåfør (valgfritt — sendes automatisk)" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="invite-email" />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary w-full text-sm" data-testid="invite-create">
          <LinkIcon size={14} className="inline mr-2" /> {creating ? "Oppretter…" : inviteEmail ? "Send invitasjons-e-post" : "Opprett invitasjons-lenke"}
        </button>
      </div>

      {invites.length === 0 && <div className="text-center py-6 text-[#7a827a] text-sm">Ingen invitasjoner ennå</div>}
      {invites.map((inv) => (
        <div key={inv.token} className="card p-3" data-testid={`invite-${inv.token}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${inv.used ? "bg-[#17222a] text-[#7a827a]" : "bg-mint/10 text-mint"}`}>
              {inv.used ? "Brukt" : "Aktiv"}
            </span>
            <span className="text-[11px] text-[#7a827a]">{inv.car} · {inv.plate}</span>
            <span className="text-[11px] text-[#7a827a] ml-auto">{new Date(inv.created_at).toLocaleDateString("nb-NO")}</span>
          </div>
          {inv.note && <div className="text-[12px] text-[#a8b0a8] mb-2">{inv.note}</div>}
          <button
            onClick={() => copyLink(inv.token)}
            className="w-full text-left px-3 py-2 rounded-lg bg-[#17222a] border border-line text-mint text-[11px] font-mono flex items-center gap-2 hover:border-mint"
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


function Fleets() {
  const [fleets, setFleets] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", org_number: "", owner_email: "", commission_rate: 0.20 });

  const load = () => adminFleetsApi.list().then((r) => setFleets(r.fleets)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim() || !form.owner_email.trim()) { alert("Navn + eier-e-post påkrevd"); return; }
    setCreating(true);
    try {
      await adminFleetsApi.create(form);
      setForm({ name: "", org_number: "", owner_email: "", commission_rate: 0.20 });
      await load();
    } catch (e) {
      alert("Kunne ikke opprette: " + (e.response?.data?.detail || e.message));
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="text-white text-sm font-medium mb-3">Ny flåte</div>
        <div className="space-y-2 mb-2">
          <input className="input" placeholder="Flåtenavn (f.eks. Oslo Nord Taxi AS)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="fleet-name" />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Org.nr" value={form.org_number} onChange={(e) => setForm({ ...form, org_number: e.target.value })} data-testid="fleet-org" />
            <input className="input" type="number" step="0.01" min="0" max="0.5" placeholder="Provisjon 0.20" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })} data-testid="fleet-commission" />
          </div>
          <input className="input" type="email" placeholder="Eier e-post" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} data-testid="fleet-owner-email" />
        </div>
        <button onClick={submit} disabled={creating} className="btn-primary w-full text-sm" data-testid="fleet-create">
          {creating ? "Oppretter…" : "Opprett flåte"}
        </button>
      </div>
      {fleets.length === 0 && <div className="text-center py-6 text-[#7a827a] text-sm">Ingen flåter ennå</div>}
      {fleets.map((f) => (
        <div key={f.id} className="card p-4" data-testid={`fleet-${f.id}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${f.active ? "bg-mint/10 text-mint" : "bg-[#17222a] text-[#7a827a]"}`}>
              {f.active ? "Aktiv" : "Inaktiv"}
            </span>
            <span className="text-[11px] text-[#7a827a]">{f.owner_email}</span>
            <span className="text-[11px] text-[#7a827a] ml-auto">{Math.round((f.commission_rate || 0) * 100)}% avgift</span>
          </div>
          <div className="text-white text-sm font-medium">{f.name}</div>
          {f.org_number && <div className="text-[11px] text-[#7a827a]">Org.nr {f.org_number}</div>}
          <div className="mt-2 text-[12px] text-[#a8b0a8]">{f.driver_count || 0} sjåfører tilknyttet</div>
        </div>
      ))}
    </div>
  );
}
