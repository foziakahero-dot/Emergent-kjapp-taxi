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
  const deepLink = useMemo(() => deepLinkFor(pathname, new URLSearchParams(window.location.search)), [pathname]);
  const success = pathname === '/payment/success';
  const cancelled = pathname === '/payment/cancel' || new URLSearchParams(window.location.search).get('setup') === 'cancel';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deepLink]);

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.icon, ...(success ? styles.iconSuccess : {}) }}>{success ? '✓' : cancelled ? '×' : 'K'}</div>
        <div style={styles.brand}>KJAPP</div>
        <h1 style={styles.title}>{success ? 'Betaling fullført' : cancelled ? 'Avbrutt' : 'Kort verifisert'}</h1>
        <p style={styles.text}>
          {success
            ? 'Vi sender deg tilbake til KJAPP og bekrefter betalingen.'
            : cancelled
              ? 'Ingen ny betaling ble registrert. Du kan gå tilbake til KJAPP og prøve igjen.'
              : 'Vi sender deg tilbake til KJAPP for å fullføre kortoppsettet.'}
        </p>
        <a href={deepLink} style={styles.button}>Åpne KJAPP</a>
        <p style={styles.hint}>Hvis appen ikke åpnes automatisk, trykk på knappen over.</p>
      </div>
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
    borderRadius: 28,
    border: '1px solid rgba(244,244,240,0.10)',
    background: '#0E151A',
    padding: '36px 28px',
    textAlign: 'center',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    margin: '0 auto 18px',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(203,163,101,0.14)',
    border: '1px solid #CBA365',
    color: '#CBA365',
    fontSize: 30,
    fontWeight: 800,
  },
  iconSuccess: {
    background: '#2FE08C',
    borderColor: '#2FE08C',
    color: '#04120A',
  },
  brand: {
    color: '#CBA365',
    letterSpacing: '0.22em',
    fontSize: 11,
    fontWeight: 800,
  },
  title: {
    margin: '10px 0 8px',
    fontSize: 28,
    lineHeight: 1.15,
  },
  text: {
    margin: '0 auto',
    maxWidth: 330,
    color: '#8A96A0',
    lineHeight: 1.55,
    fontSize: 15,
  },
  button: {
    display: 'inline-flex',
    marginTop: 24,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    borderRadius: 999,
    background: '#CBA365',
    color: '#070B0E',
    textDecoration: 'none',
    fontWeight: 800,
  },
  hint: {
    margin: '14px 0 0',
    color: '#68727B',
    fontSize: 12,
  },
};
