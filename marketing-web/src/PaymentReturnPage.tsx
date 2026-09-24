import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

type PaymentReturnKind = 'trip-success' | 'trip-cancel' | 'setup-success' | 'setup-cancel';

function safeParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value && value.length <= 256 ? value : '';
}

export function PaymentReturnPage({ kind }: { kind: PaymentReturnKind }) {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const target = useMemo(() => {
    const sessionId = safeParam(params, 'session_id');
    const tripId = safeParam(params, 'trip_id');

    if (kind === 'trip-success') {
      return `kjapp://payment/success${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`;
    }
    if (kind === 'trip-cancel') {
      return `kjapp://payment/cancel${tripId ? `?trip_id=${encodeURIComponent(tripId)}` : ''}`;
    }
    if (kind === 'setup-success') {
      return `kjapp://payment-methods?setup=success${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ''}`;
    }
    return 'kjapp://payment-methods?setup=cancel';
  }, [kind, params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign(target);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [target]);

  const success = kind === 'trip-success' || kind === 'setup-success';
  const title = kind.startsWith('setup')
    ? (success ? 'Kortet er bekreftet' : 'Kortoppsettet ble avbrutt')
    : (success ? 'Betalingen er mottatt' : 'Betalingen ble avbrutt');

  return (
    <main style={{
      minHeight: '100vh',
      background: '#070B0E',
      color: '#F4F7F8',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <section style={{
        width: 'min(460px, 100%)',
        border: '1px solid #22303b',
        borderRadius: 24,
        background: '#0D141A',
        padding: 28,
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,.35)',
      }}>
        <div style={{fontSize: 12, letterSpacing: '.16em', color: '#2DD4BF', fontWeight: 800}}>KJAPP</div>
        <h1 style={{fontSize: 26, margin: '14px 0 10px'}}>{title}</h1>
        <p style={{color: '#9AA8B4', lineHeight: 1.55, margin: 0}}>
          Vi åpner KJAPP-appen slik at status kan bekreftes mot serveren.
        </p>
        <a
          href={target}
          style={{
            display: 'inline-flex',
            marginTop: 22,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            padding: '0 22px',
            background: '#2DD4BF',
            color: '#04110F',
            textDecoration: 'none',
            fontWeight: 800,
          }}
        >
          Åpne KJAPP
        </a>
        <div style={{marginTop: 18}}>
          <Link to="/" style={{color: '#9AA8B4', fontSize: 13}}>Til kjappapp.no</Link>
        </div>
      </section>
    </main>
  );
}
