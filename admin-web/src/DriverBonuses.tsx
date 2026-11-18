import React, { FormEvent, useState } from 'react';
import { http, apiError } from './api';
import { Btn, fmtMoney, useAsync } from './ui';

type Campaign = {
  id: string; name: string; active: boolean; trips_required: number; bonus_kr: number;
  start_hour: number; end_hour: number; max_per_driver_per_day: number; spent_kr: number;
};

export default function DriverBonuses() {
  const campaigns = useAsync<Campaign[]>(async () => (await http.get('/admin/bonus-campaigns')).data.campaigns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try { await action(); campaigns.reload(); }
    catch (reason) { setError(apiError(reason)); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const numeric = (name: string) => Number(data.get(name));
    const name = String(data.get('name') || '').trim();
    if (!name || numeric('end_hour') <= numeric('start_hour')) {
      setError('Oppgi kampanjenavn og en sluttid etter starttid.');
      return;
    }
    void save(async () => {
      await http.post('/admin/bonus-campaigns', {
        name, trips_required: numeric('trips_required'), bonus_kr: numeric('bonus_kr'),
        start_hour: numeric('start_hour'), end_hour: numeric('end_hour'),
        max_per_driver_per_day: numeric('max_per_driver_per_day'), active: false,
      });
      form.reset();
    });
  }
  return <div className="page">
    <h1>Sjåførbonus</h1>
    <p className="dim">Kampanjer gjelder betalte turer i valgt tidsrom. Klokkeslett følger norsk tid.</p>
    <form className="card" onSubmit={create}>
      <h2>Ny kampanje</h2>
      <label>Navn<input className="input" name="name" maxLength={100} required /></label>
      <div className="form-grid">
        {([
          ['trips_required', 'Antall turer', 1, 50, 5], ['bonus_kr', 'Bonus i kroner', 1, 5000, 100],
          ['start_hour', 'Fra klokken', 0, 23, 0], ['end_hour', 'Til klokken', 1, 24, 24],
          ['max_per_driver_per_day', 'Maks bonuser per sjåfør per dag', 1, 10, 1],
        ] as const).map(([key, label, min, max, initial]) => <label key={key}>{label}
          <input className="input" type="number" name={key} required min={min} max={max} defaultValue={initial} />
        </label>)}
      </div>
      <button type="submit" className="btn" disabled={busy}>Opprett inaktiv kampanje</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <h2>Kampanjer</h2>
    {campaigns.loading ? <p>Laster kampanjer …</p> : campaigns.err ? <p role="alert">{campaigns.err} <Btn onClick={campaigns.reload}>Prøv igjen</Btn></p>
      : campaigns.data?.length ? <table><thead><tr><th>Navn</th><th>Mål</th><th>Tidsrom</th><th>Opptjent totalt</th><th>Status</th><th>Handling</th></tr></thead>
        <tbody>{campaigns.data.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.trips_required} turer · {fmtMoney(c.bonus_kr)}</td>
          <td>{c.start_hour}–{c.end_hour}</td><td>{fmtMoney(c.spent_kr)}</td><td>{c.active ? 'Aktiv' : 'Inaktiv'}</td>
          <td><Btn disabled={busy} onClick={() => void save(() => http.patch('/admin/bonus-campaigns/' + c.id, { active: !c.active }))}>
            {c.active ? 'Stans' : 'Aktiver'}</Btn></td></tr>)}</tbody></table>
        : <p>Ingen bonuskampanjer opprettet.</p>}
  </div>;
}
