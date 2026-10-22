import React, { useState } from 'react';
import { useAuth } from './auth';
import { apiError } from './api';
import { Btn } from './ui';
import { Icon, SnarMark } from './snar-ui';

export default function Login() {
  const { login, verify2fa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
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
    <div className="login-page">
      <div className="login-brand"><SnarMark size={48}/><div className="login-brand-text"><strong>SNAR</strong><span>CONTROL CENTER</span></div></div>
      <div className="login-card">
        <div className="login-head">
          {twofaToken && <div className="twofa-icon"><Icon name="shield" size={24}/></div>}
          <h1 className="login-title">{twofaToken ? 'Tofaktorkontroll' : 'Logg inn'}</h1>
          <p className="login-sub">{twofaToken ? useBackup ? 'Skriv inn en ubrukt reservekode.' : 'Skriv inn koden fra autentiseringsappen din.' : 'SNAR administrasjonsportal · Kun autoriserte brukere'}</p>
        </div>
        {err && <div className="error-banner" role="alert">{err}</div>}
        {!twofaToken ? (
          <form className="login-form" onSubmit={submit}>
            <label className="login-field"><span>E-postadresse</span><input type="email" autoComplete="username" autoFocus required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@snarapp.no"/></label>
            <label className="login-field"><span>Passord</span><input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
            <a className="login-forgot" href="/forgot-password">Glemt passord?</a>
            <Btn variant="primary full" type="submit" disabled={loading || !email || !password}>{loading ? 'Logger inn…' : 'Fortsett'}</Btn>
          </form>
        ) : (
          <form className="login-form" onSubmit={submit2fa}>
            <label className="login-field"><span>{useBackup ? 'Reservekode' : '6-sifret kode'}</span><input key={String(useBackup)} className="code-input" inputMode={useBackup ? 'text' : 'numeric'} autoComplete="one-time-code" autoFocus required pattern={useBackup ? '[0-9a-fA-F]{4}-[0-9a-fA-F]{4}' : '[0-9]{6}'} maxLength={useBackup ? 9 : 6} value={code} onChange={e => setCode(useBackup ? e.target.value.toLowerCase() : e.target.value.replace(/\D/g, ''))} placeholder={useBackup ? 'abcd-1234' : '000000'}/></label>
            <Btn variant="primary full" type="submit" disabled={loading || !(useBackup ? /^[0-9a-f]{4}-[0-9a-f]{4}$/.test(code) : /^[0-9]{6}$/.test(code))}>{loading ? 'Verifiserer…' : 'Logg inn'}</Btn>
            <button className="login-forgot" type="button" onClick={() => { setUseBackup(!useBackup); setCode(''); setErr(''); }}>{useBackup ? 'Bruk autentiseringsappen' : 'Bruk en reservekode'}</button>
            <button className="login-forgot" type="button" onClick={() => { setTwofaToken(''); setUseBackup(false); setCode(''); setErr(''); }}>← Tilbake til innlogging</button>
          </form>
        )}
        <div className="login-security"><Icon name="lock" size={13}/><span>Sikker innlogging · Kun autoriserte administratorer</span></div>
      </div>
      <p className="login-footer">© {new Date().getFullYear()} SNAR · Control Center</p>
    </div>
  );
}
