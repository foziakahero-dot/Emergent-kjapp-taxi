import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { checkPasswordResetToken, resetPassword } from './api';

export default function PasswordResetPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'checking'|'form'|'invalid'|'done'>('checking');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    checkPasswordResetToken(token)
      .then(() => setState('form'))
      .catch(() => setState('invalid'));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Passord må ha minst 8 tegn.');
      return;
    }
    if (password !== again) {
      setError('Passordene er ikke like.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      setState('done');
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke endre passordet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: '#05090d', color: '#f7f9fb', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <section style={{ width: 'min(460px,100%)', background: '#0c1420', border: '1px solid #233144', borderRadius: 22, padding: 28 }}>
        <Link to="/" style={{ color: '#f7f9fb', textDecoration: 'none', fontWeight: 900, fontSize: 24 }}>KJAPP</Link>
        {state === 'checking' ? <p style={{ color: '#9aa8b7', marginTop: 24 }}>Kontrollerer lenken…</p> : null}
        {state === 'invalid' ? <>
          <h1 style={{ fontSize: 28, margin: '28px 0 10px' }}>Lenken virker ikke</h1>
          <p style={{ color: '#9aa8b7', lineHeight: 1.6 }}>Lenken er ugyldig eller utløpt. Be om en ny lenke fra KJAPP-appen.</p>
          <Link to="/help" style={{ color: '#11d9e8', fontWeight: 700 }}>Kontakt support</Link>
        </> : null}
        {state === 'form' ? <>
          <h1 style={{ fontSize: 28, margin: '28px 0 10px' }}>Velg nytt passord</h1>
          <p style={{ color: '#9aa8b7', lineHeight: 1.6 }}>Passordet må ha minst 8 tegn. Andre aktive økter blir ugyldige etter endringen.</p>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 22 }}>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nytt passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: 52, borderRadius: 12, border: '1px solid #2a3a4d', background: '#08111b', color: '#fff', padding: '0 14px', fontSize: 16 }}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Gjenta passord"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              style={{ height: 52, borderRadius: 12, border: '1px solid #2a3a4d', background: '#08111b', color: '#fff', padding: '0 14px', fontSize: 16 }}
            />
            {error ? <div role="alert" style={{ color: '#ff7180', fontSize: 13 }}>{error}</div> : null}
            <button disabled={busy} type="submit" style={{ minHeight: 52, border: 0, borderRadius: 12, background: '#11d9e8', color: '#041015', fontWeight: 800, fontSize: 15, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Lagrer…' : 'Lagre nytt passord'}
            </button>
          </form>
        </> : null}
        {state === 'done' ? <>
          <h1 style={{ fontSize: 28, margin: '28px 0 10px' }}>Passordet er endret</h1>
          <p style={{ color: '#9aa8b7', lineHeight: 1.6 }}>Du kan nå åpne KJAPP eller KJAPP Driver og logge inn med det nye passordet.</p>
          <a href="kjapp://login" style={{ color: '#11d9e8', fontWeight: 700, marginRight: 18 }}>Åpne KJAPP</a>
          <a href="kjapp-driver://driver-login" style={{ color: '#35d58b', fontWeight: 700 }}>Åpne KJAPP Driver</a>
        </> : null}
      </section>
    </main>
  );
}
