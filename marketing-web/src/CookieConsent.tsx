import { useEffect, useState } from 'react';

const CONSENT_KEY = 'kjapp_marketing_consent_v1';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function choose(value: 'accepted' | 'rejected') {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Consent remains session-only if storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="mk-cookie-banner" aria-label="Valg for informasjonskapsler">
      <div>
        <strong>Personvern på snarapp.no</strong>
        <p>Vi bruker kun nødvendige lokale innstillinger på denne siden nå. Valgfri analyse er ikke aktivert. Du kan lagre valget ditt nedenfor.</p>
      </div>
      <div className="mk-cookie-actions">
        <button type="button" className="mk-cookie-reject" onClick={() => choose('rejected')}>Avvis</button>
        <button type="button" className="mk-cookie-accept" onClick={() => choose('accepted')}>Godta</button>
      </div>
    </aside>
  );
}
