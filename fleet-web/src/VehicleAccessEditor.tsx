import { useEffect, useState } from 'react';
import { api, apiError, FleetDriverDetail, FleetVehicle } from './api';

export default function VehicleAccessEditor({ driver, vehicles, onSaved }: {
  driver: FleetDriverDetail; vehicles: FleetVehicle[]; onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'assigned' | 'selected' | 'all'>(driver.vehicle_access_mode || 'assigned');
  const [ids, setIds] = useState<string[]>(driver.allowed_vehicle_ids || []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setMode(driver.vehicle_access_mode || 'assigned');
    setIds(driver.allowed_vehicle_ids || []);
  }, [driver.id, driver.vehicle_access_mode, driver.allowed_vehicle_ids]);
  const locked = Boolean(driver.online || driver.active_trip);
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.setVehicleAccess(driver.id, mode, mode === 'selected' ? ids : []);
      await onSaved(); setMessage('Biltilgangen er lagret. Sjåføren velger bil ved neste vakt.');
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  };
  return <div className="v2-invite-form" style={{ padding: '20px 0' }}>
    <h3>Varig tilgang til biler</h3>
    <p>Tilgangen gjelder din egen flåte. Flere sjåfører kan ha tilgang til samme bil, men bare én kan bruke den om gangen.</p>
    <label>Biltilgang<select value={mode} disabled={locked || busy} onChange={(event) => setMode(event.target.value as typeof mode)}>
      <option value="assigned">Bare fast tildelt bil</option>
      <option value="selected">Valgte biler</option>
      <option value="all">Alle aktive biler i min flåte</option>
    </select></label>
    {mode === 'selected' ? <fieldset disabled={locked || busy}><legend>Velg biler</legend>
      {vehicles.filter((vehicle) => vehicle.active !== false).map((vehicle) => <label key={vehicle.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={ids.includes(vehicle.id)} onChange={(event) => setIds((current) => event.target.checked ? [...current, vehicle.id] : current.filter((id) => id !== vehicle.id))} />
        {vehicle.car || 'Kjøretøy'} · {vehicle.plate || '—'}
      </label>)}
    </fieldset> : null}
    {locked ? <p>Sjåføren må være offline og ferdig med aktiv tur før du endrer biltilgangen.</p> : null}
    <button type="button" className="v2-primary" disabled={locked || busy || (mode === 'selected' && !ids.length)} onClick={() => void save()}>{busy ? 'Lagrer…' : 'Lagre biltilgang'}</button>
    {message ? <p role="status">{message}</p> : null}
    {error ? <div className="v2-inline-error" role="alert">{error}</div> : null}
  </div>;
}
