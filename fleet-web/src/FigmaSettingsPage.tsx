import React, { useEffect, useState } from 'react';
import { api, apiError, FleetMe } from './api';
import { useAuth } from './auth';

export function FigmaSettingsPage() {
  const { user, logout } = useAuth();
  const [fleet, setFleet] = useState<FleetMe | null>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [error, setError] = useState('');
  const [openingStripe, setOpeningStripe] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.fleetMe(),
      api.stripeStatus().catch(() => null),
    ]).then(([fleetData, stripeData]) => {
      if (!alive) return;
      setFleet(fleetData);
      setStripe(stripeData);
    }).catch((e) => alive && setError(apiError(e)));
    return () => { alive = false; };
  }, []);

  const openStripe = async () => {
    setOpeningStripe(true);
    setError('');
    try {
      const result = await api.stripeOnboarding();
      const url = new URL(result.onboarding_url);
      if (!['https:'].includes(url.protocol)) throw new Error('Ugyldig Stripe-lenke');
      window.location.assign(url.toString());
    } catch (e) {
      setError(apiError(e));
      setOpeningStripe(false);
    }
  };

  const stripeReady = Boolean(stripe?.connected || stripe?.charges_enabled || stripe?.details_submitted || stripe?.payouts_enabled);

  return <div className="figma-page settings-page">
    <div className="figma-page-head">
      <div>
        <span className="figma-kicker">INNSTILLINGER</span>
        <h1>Flåte og konto</h1>
        <p>Firmainformasjon, betaling, sikkerhet og tilgang for SNAR Fleet.</p>
      </div>
    </div>

    <div className="settings-layout">
      <section className="figma-card settings-card">
        <span className="figma-kicker">FLÅTEINFORMASJON</span>
        <h2>{fleet?.name || 'SNAR Fleet'}</h2>
        <div className="settings-fields">
          <label>Firmanavn<input value={fleet?.name || ''} readOnly /></label>
          <label>Organisasjonsnummer<input value={fleet?.org_number || ''} readOnly /></label>
          <label>Kontaktperson<input value={fleet?.contact_name || ''} readOnly /></label>
          <label>Telefon<input value={fleet?.contact_phone || ''} readOnly /></label>
          <label className="wide">E-post<input value={fleet?.contact_email || ''} readOnly /></label>
        </div>
        <div className="settings-hint">Firmadata kommer fra den eksisterende Fleet-backenden. Redigering er ikke eksponert i API-et ennå, derfor vises feltene read-only i stedet for å late som de kan lagres.</div>
      </section>

      <aside className="figma-card settings-card payment-settings">
        <span className="figma-kicker">BETALING</span>
        <h2>Stripe Connect</h2>
        <div className={`settings-status ${stripeReady ? 'ready' : 'pending'}`}><i />{stripeReady ? 'Tilkoblet' : 'Krever oppsett'}</div>
        <dl>
          <div><dt>Detaljer sendt</dt><dd>{stripe?.details_submitted ? 'Ja' : 'Nei'}</dd></div>
          <div><dt>Utbetalinger</dt><dd>{stripe?.payouts_enabled ? 'Aktiv' : 'Ikke klar'}</dd></div>
          <div><dt>Betalinger</dt><dd>{stripe?.charges_enabled ? 'Aktiv' : 'Ikke klar'}</dd></div>
        </dl>
        {!stripeReady ? <button className="settings-primary" onClick={() => void openStripe()} disabled={openingStripe}>{openingStripe ? 'Åpner Stripe…' : 'Fullfør Stripe Connect'}</button> : null}
      </aside>

      <section className="figma-card settings-card account-settings">
        <span className="figma-kicker">KONTO & SIKKERHET</span>
        <h2>Innlogget bruker</h2>
        <div className="account-profile">
          <div className="account-avatar">{(user?.fullName || user?.email || 'S').slice(0, 1).toUpperCase()}</div>
          <div><strong>{user?.fullName || 'Løyvehaver'}</strong><span>{user?.email || '—'}</span></div>
        </div>
        <div className="account-security-row"><span><strong>Rolle</strong><small>Tilgang styres av backend RBAC</small></span><b>Fleet Owner</b></div>
        <div className="account-security-row"><span><strong>Sesjon</strong><small>JWT-basert autentisering</small></span><b>Aktiv</b></div>
        <button className="settings-logout" onClick={logout}>Logg ut av SNAR Fleet</button>
      </section>

      <section className="figma-card settings-card system-settings">
        <span className="figma-kicker">SYSTEM</span>
        <h2>Integrasjoner</h2>
        <div className="integration-list">
          <div><span><i className="green" />Fleet API</span><b>Aktiv</b></div>
          <div><span><i className="green" />MongoDB</span><b>Samme backend</b></div>
          <div><span><i className={stripeReady ? 'green' : 'amber'} />Stripe Connect</span><b>{stripeReady ? 'Klar' : 'Oppsett pågår'}</b></div>
          <div><span><i className="green" />Live GPS</span><b>/fleet/live</b></div>
        </div>
      </section>
    </div>

    {error ? <div className="figma-error">{error}</div> : null}
  </div>;
}

export default FigmaSettingsPage;
