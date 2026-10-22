import React, { useEffect, useState } from 'react';
import { api, apiError } from './api';
import { useAuth } from './auth';
import { Btn, Loader } from './ui';
import { SnarMark } from './snar-ui';
import TwoFactorCard from './TwoFactorCard';

// Account-security endpoints remain available before the backend grants admin
// access. Do not mount operational pages (or their requests) during enrollment.
export default function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [status, setStatus] = useState<{ enabled: boolean; required: boolean } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    api.twofaStatus().then((value) => {
      if (!value || typeof value.enabled !== 'boolean' || typeof value.required !== 'boolean') {
        throw new Error('Kunne ikke bekrefte kontosikkerheten. Prøv igjen.');
      }
      if (active) setStatus(value);
    }).catch((err) => { if (active) setError(apiError(err)); });
    return () => { active = false; };
  }, [attempt]);

  if (!status && !error) return <div className="auth-wrap"><Loader /></div>;
  if (status?.enabled) return <>{children}</>;
  return <div className="login-page">
    <div className="login-brand"><SnarMark size={48} /><strong>SNAR CONTROL CENTER</strong></div>
    <main className="login-card" style={{ width: 'min(100%, 620px)' }}>
      <h1 className="login-title">Aktiver totrinnsbekreftelse</h1>
      <p className="login-sub">Beskytt administratorkontoen før du får tilgang til kontrollsenteret.</p>
      {error ? <><div className="error-banner" role="alert">{error}</div><Btn onClick={() => { setError(''); setAttempt(n => n + 1); }}>Prøv igjen</Btn></> : <TwoFactorCard onComplete={logout} />}
      <Btn variant="ghost" onClick={logout}>Logg ut</Btn>
    </main>
  </div>;
}
