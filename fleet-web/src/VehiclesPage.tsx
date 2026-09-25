import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, apiError, FleetDriver, FleetVehicle } from './api';

const nameOf = (d: FleetDriver) => d.fullName || d.full_name || d.email || 'Sjåfør';

const TYPE_LABEL: Record<string, string> = {
  'ai-first': 'Standard',
  enkelt: 'Sparsom',
  trygg: 'Komfort',
  premium: 'Premium',
};

function ErrorBox({ message }: { message: string }) {
  return message ? <div className="error-box">{message}</div> : null;
}

function VehicleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [car, setCar] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('ai-first');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.createVehicle({
        car: car.trim(),
        plate: plate.trim().toUpperCase(),
        vehicle_type: vehicleType,
        color: color.trim() || undefined,
        year: year ? Number(year) : undefined,
      });
      onDone();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div><span className="eyebrow">NY BIL</span><h2>Registrer kjøretøy</h2></div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        <p>Bilen tilhører flåten. Etterpå kan du tildele den til én eller flere sjåfører.</p>
        <input placeholder="Bilmodell, f.eks. Tesla Model Y" value={car} onChange={(e) => setCar(e.target.value)} required />
        <input placeholder="Skiltnummer" value={plate} onChange={(e) => setPlate(e.target.value)} required />
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
          <option value="ai-first">Standard</option>
          <option value="enkelt">Sparsom</option>
          <option value="trygg">Komfort</option>
          <option value="premium">Premium</option>
        </select>
        <input placeholder="Farge (valgfritt)" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="number" min="1990" max="2100" placeholder="Årsmodell (valgfritt)" value={year} onChange={(e) => setYear(e.target.value)} />
        <ErrorBox message={err} />
        <button className="primary-button" disabled={busy}>{busy ? 'Registrerer…' : 'Registrer bil'}</button>
      </form>
    </div>
  );
}

function AssignmentModal({
  vehicle,
  drivers,
  allVehicles,
  onClose,
  onDone,
}: {
  vehicle: FleetVehicle;
  drivers: FleetDriver[];
  allVehicles: FleetVehicle[];
  onClose: () => void;
  onDone: () => void;
}) {
  const initial = new Set(vehicle.assigned_driver_ids || []);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (driverId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      for (const driver of drivers) {
        const desired = allVehicles
          .filter((v) => v.id !== vehicle.id && (v.assigned_driver_ids || []).includes(driver.id))
          .map((v) => v.id);

        if (selected.has(driver.id)) desired.push(vehicle.id);

        const before = new Set(
          allVehicles
            .filter((v) => (v.assigned_driver_ids || []).includes(driver.id))
            .map((v) => v.id),
        );
        const after = new Set(desired);
        const changed = before.size !== after.size || [...before].some((id) => !after.has(id));
        if (changed) await api.assignDriverVehicles(driver.id, desired);
      }
      onDone();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">TILDELING</span><h2>{vehicle.car}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>
        <p>{vehicle.plate} · velg hvilke sjåfører som kan bruke bilen. Sjåføren velger selv aktiv bil i Driver-appen.</p>

        <div className="assignment-list">
          {drivers.map((d) => (
            <label className="assignment-row" key={d.id}>
              <span>
                <strong>{nameOf(d)}</strong>
                <small>{d.email || d.phone || '—'}</small>
              </span>
              <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
            </label>
          ))}
          {!drivers.length ? <div className="empty-state">Ingen sjåfører i flåten ennå.</div> : null}
        </div>

        <ErrorBox message={err} />
        <button className="primary-button" type="button" disabled={busy} onClick={save}>
          {busy ? 'Lagrer…' : 'Lagre tildeling'}
        </button>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [assigning, setAssigning] = useState<FleetVehicle | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setErr('');
    setLoading(true);
    try {
      const [v, d] = await Promise.all([api.vehicles(), api.drivers()]);
      setVehicles(v.vehicles || []);
      setDrivers(d.drivers || []);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rows = useMemo(
    () => vehicles.filter((v) => `${v.car} ${v.plate} ${v.color || ''}`.toLowerCase().includes(q.toLowerCase())),
    [vehicles, q],
  );

  const disableVehicle = async (v: FleetVehicle) => {
    try {
      await api.updateVehicle(v.id, { active: !v.active });
      await load();
    } catch (e) {
      setErr(apiError(e));
    }
  };

  const assignedNames = (v: FleetVehicle) => {
    const ids = new Set(v.assigned_driver_ids || []);
    const names = drivers.filter((d) => ids.has(d.id)).map(nameOf);
    if (!names.length) return 'Ingen';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  };

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>Biler</h1>
          <p>Flåtens kjøretøy og hvilke sjåfører som kan bruke dem</p>
        </div>
        <button className="primary-button compact-button" onClick={() => setCreateOpen(true)}>+ Legg til bil</button>
      </div>

      <div className="table-card">
        <div className="table-tools">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk bil, skilt eller farge" />
        </div>

        <div className="fleet-table vehicle-table">
          <div className="tr th">
            <span>BIL</span><span>SKILT</span><span>KLASSE</span><span>TILDELT</span><span>STATUS</span><span />
          </div>

          {loading ? <div className="page-loading"><div className="spinner" /></div> : rows.map((v) => (
            <div className="tr" key={v.id}>
              <span>
                <strong>{v.car}</strong>
                <small>{[v.color, v.year].filter(Boolean).join(' · ') || '—'}</small>
              </span>
              <span className="mono">{v.plate}</span>
              <span>{TYPE_LABEL[v.vehicle_type] || v.vehicle_type}</span>
              <span>{assignedNames(v)}</span>
              <span className={v.active ? 'status-green' : 'status-red'}>{v.active ? 'Aktiv' : 'Deaktivert'}</span>
              <span className="vehicle-actions">
                <button className="secondary-button compact-button" onClick={() => setAssigning(v)}>Tildel</button>
                <button className="text-button" onClick={() => disableVehicle(v)}>{v.active ? 'Deaktiver' : 'Aktiver'}</button>
              </span>
            </div>
          ))}

          {!loading && !rows.length ? <div className="empty-state padded">Ingen biler registrert.</div> : null}
        </div>
      </div>

      <ErrorBox message={err} />

      {createOpen ? <VehicleModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); void load(); }} /> : null}
      {assigning ? (
        <AssignmentModal
          vehicle={assigning}
          drivers={drivers}
          allVehicles={vehicles}
          onClose={() => setAssigning(null)}
          onDone={() => { setAssigning(null); void load(); }}
        />
      ) : null}
    </div>
  );
}
