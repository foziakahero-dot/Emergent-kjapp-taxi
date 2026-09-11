import React, { useState } from 'react';
import { useAuth } from './auth';
import { apiError } from './api';
import { Btn } from './ui';

export default function Login() {
  const { login, verify2fa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twofaToken, setTwofaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) { setTwofaToken(res.twofa_token); }
    } catch (e2) { setErr(apiError(e2)); }
    finally { setLoading(false); }
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try { await verify2fa(twofaToken, code.trim()); }
    catch (e2) { setErr(apiError(e2)); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">K</div><div className="brand-name">KJAPP</div></div>
        <div className="auth-sub">Kontrollsenter · kun for administratorer</div>

        {err && <div className="error-banner">{err}</div>}

        {!twofaToken ? (
          <form onSubmit={submit}>
            <div className="field">
              <label className="label">E-post</label>
              <input className="input" type="email" autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="admin@kjapp.no" />
            </div>
            <div className="field">
              <label className="label">Passord</label>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Btn variant="primary full" type="submit" disabled={loading || !email || !password}>
              {loading ? 'Logger inn…' : 'Logg inn'}
            </Btn>
          </form>
        ) : (
          <form onSubmit={submit2fa}>
            <div className="auth-sub" style={{ marginTop: -8 }}>Skriv inn 6-sifret kode fra autentiseringsappen din.</div>
            <div className="field">
              <label className="label">Verifiseringskode</label>
              <input className="input mono" inputMode="numeric" autoFocus value={code}
                onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={8}
                style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }} />
            </div>
            <Btn variant="primary full" type="submit" disabled={loading || code.length < 6}>
              {loading ? 'Verifiserer…' : 'Bekreft'}
            </Btn>
            <Btn variant="ghost full" type="button" style={{ marginTop: 8 }} onClick={() => { setTwofaToken(''); setCode(''); }}>
              Tilbake
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}
