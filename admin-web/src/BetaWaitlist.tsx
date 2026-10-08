import React, { useCallback, useEffect, useState } from 'react';
import { api, apiError } from './api';
import { Btn, Empty, ErrorBanner, fmtDate, Loader, PageHead } from './ui';

type Interest = { id: string; name: string; phone: string; email: string; city: string;
  role: string; status: string; created_at: string; confirmation_email_status: string };
type Result = { items: Interest[]; total: number; email_configured: boolean };
const ROLES: Record<string, string> = { passenger: 'Kunde', driver: 'Sjåfør', fleet_owner: 'Løyvehaver' };
const STATUS: Record<string, string> = { new: 'Ny', contacted: 'Kontaktet', archived: 'Arkivert' };
const EMAIL: Record<string, string> = { sent: 'Sendt til e-postleverandør', pending: 'Venter', sending: 'Sender', failed: 'Feilet', not_requested: 'Ingen e-post' };
const LIMIT = 50;

export default function BetaWaitlist() {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    api.betaWaitlist({ role: role || undefined, status: status || undefined, offset, limit: LIMIT })
      .then((result: Result) => { if (active) setData(result); })
      .catch((err: unknown) => { if (active) setError(apiError(err)); });
    return () => { active = false; };
  }, [role, status, offset, refresh]);
  async function change(id: string, value: string) {
    setBusy(id); setError('');
    try { await api.updateBetaInterest(id, value); reload(); }
    catch (err) { setError(apiError(err)); }
    finally { setBusy(''); }
  }
  return <>
    <PageHead title="Beta-påmeldinger" sub="Interesse fra snarapp.no · kunder, sjåfører og løyvehavere"
      right={<Btn onClick={reload}>Oppdater</Btn>} />
    <p>Påmeldingen gir samtykke til kontakt om beta. Kunden oppretter brukerkonto i appen.
      Løyvehavere sender en egen søknad under Løyvesøknader før Fleet-tilgang godkjennes.</p>
    <ErrorBanner msg={error} />
    {data && !data.email_configured ? <div className="error-banner" role="alert">
      Automatisk e-post er ikke konfigurert. Påmeldingene er lagret, men bekreftelser venter på e-postoppsett.
    </div> : null}
    <div className="filters" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <label>Rolle <select value={role} onChange={(e) => { setRole(e.target.value); setOffset(0); }}>
        <option value="">Alle roller</option>{Object.entries(ROLES).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
      <label>Status <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
        <option value="">Alle statuser</option>{Object.entries(STATUS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
    </div>
    {!data && !error ? <Loader /> : data ? <>
      <div className="tablewrap"><table><thead><tr><th>Navn</th><th>Kontakt</th><th>By / rolle</th><th>Registrert</th><th>E-postbekreftelse</th><th>Status</th></tr></thead>
        <tbody>{data.items.map((item) => <tr key={item.id}>
          <td>{item.name}</td><td>{item.phone}<br />{item.email || 'Ingen e-post oppgitt'}</td>
          <td>{item.city}<br />{ROLES[item.role] || item.role}</td><td>{fmtDate(item.created_at)}</td>
          <td>{EMAIL[item.confirmation_email_status] || item.confirmation_email_status}</td>
          <td><select aria-label={`Status for ${item.name}`} value={item.status} disabled={Boolean(busy)}
            onChange={(e) => void change(item.id, e.target.value)}>
            {Object.entries(STATUS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select></td>
        </tr>)}{data.items.length === 0 ? <tr><td colSpan={6}><Empty title="Ingen påmeldinger" sub="Nye påmeldinger fra snarapp.no vises her." /></td></tr> : null}</tbody></table></div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
        <Btn disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Forrige</Btn>
        <span>{data.total === 0 ? '0' : `${offset + 1}–${Math.min(offset + LIMIT, data.total)}`} av {data.total}</span>
        <Btn disabled={offset + LIMIT >= data.total} onClick={() => setOffset(offset + LIMIT)}>Neste</Btn>
      </div>
    </> : null}
  </>;
}
