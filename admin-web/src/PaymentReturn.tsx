import React, { useEffect, useMemo } from 'react';

function deepLinkFor(pathname: string, params: URLSearchParams) {
  if (pathname === '/payment/success') {
    const sessionId = params.get('session_id') || '';
    return `kjapp://payment/success${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`;
  }
  if (pathname === '/payment/cancel') {
    const tripId = params.get('trip_id') || '';
    return `kjapp://payment/cancel${tripId ? `?trip_id=${encodeURIComponent(tripId)}` : ''}`;
  }
  if (pathname === '/app/payment-methods') {
    const setup = params.get('setup') || '';
    const sessionId = params.get('session_id') || '';
    const query = new URLSearchParams();
    if (setup) query.set('setup', setup);
    if (sessionId) query.set('session_id', sessionId);
    return `kjapp://payment-methods${query.toString() ? `?${query.toString()}` : ''}`;
  }
  return 'kjapp://';
}

export default function PaymentReturn() {
  const pathname = window.location.pathname;
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const deepLink = useMemo(() => deepLinkFor(pathname, params), [pathname, params]);
  const success = pathname === '/payment/success';
  const cancelled = pathname === '/payment/cancel' || params.get('setup') === 'cancel';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deepLink]);

  return (
    <main style={styles.page} data-testid="native-payment-return">
      <section style={styles.card}>
        <div style={{ ...styles.icon, ...(success ? styles.successIcon : {}) }}>
          {success ? '✓' : cancelled ? '×' : 'K'}
        </div>
        <div style={styles.brand}>KJAPP</div>
        <h1 style={styles.title}>{success ? 'Betaling fullført' : cancelled ? 'Avbrutt' : 'Kort verifisert'}</h1>
        <p style={styles.copy}>
          {success
            ? 'Betalingen er registrert. Vi sender deg tilbake til KJAPP.'
            : cancelled
              ? 'Ingen ny betaling ble registrert. Gå tilbake til KJAPP for å prøve igjen.'
              : 'Kortoppsettet er ferdig. Vi sender deg tilbake til KJAPP.'}
        </p>
        <a href={deepLink} style={styles.button}>Åpne KJAPP</a>
        <p style={styles.hint}>Hvis appen ikke åpnes automatisk, trykk på knappen.</p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: '#070B0E',
    color: '#F4F4F0',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  card: {
    width: 'min(440px, 100%)',
    boxSizing: 'border-box',
    padding: '36px 28px',
    borderRadius: 28,
    border: '1px solid rgba(244,244,240,0.10)',
    background: '#0E151A',
    textAlign: 'center',
    boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 18px',
    background: 'rgba(203,163,101,0.14)',
    border: '1px solid #CBA365',
    color: '#CBA365',
    fontSize: 30,
    fontWeight: 800,
  },
  successIcon: { background: '#2FE08C', borderColor: '#2FE08C', color: '#04120A' },
  brand: { color: '#CBA365', fontSize: 11, fontWeight: 800, letterSpacing: '0.22em' },
  title: { margin: '10px 0 8px', fontSize: 28, lineHeight: 1.15 },
  copy: { maxWidth: 340, margin: '0 auto', color: '#8A96A0', fontSize: 15, lineHeight: 1.55 },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 24,
    padding: '0 24px',
    borderRadius: 999,
    background: '#CBA365',
    color: '#070B0E',
    textDecoration: 'none',
    fontWeight: 800,
  },
  hint: { margin: '14px 0 0', color: '#68727B', fontSize: 12 },
};
