import React, { useState } from 'react';
import { useAuth } from './auth';
import { api, apiError } from './api';
import { Btn } from './ui';

export default function Login() {
  const { login, verify2fa, completeLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twofaToken, setTwofaToken] = useState('');
  const [enrollSetup, setEnrollSetup] = useState<any>(null);
  const [enrollResult, setEnrollResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res?.twofa_required) {
        setTwofaToken(res.twofa_token);
      } else if (res?.twofa_setup_required) {
        setTwofaToken(res.twofa_token);
        setEnrollSetup(await api.twofaEnrollSetup(res.twofa_token));
      }
    } catch (e2) { setErr(apiError(e2)); }
    finally { setLoading(false); }
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      if (enrollSetup) {
        // Do not enter the control center until the one-time backup codes were shown.
        setEnrollResult(await api.twofaEnrollEnable(twofaToken, code.trim()));
      } else {
        await verify2fa(twofaToken, code.trim());
      }
    } catch (e2) { setErr(apiError(e2)); }
    finally { setLoading(false); }
  };

  const resetChallenge = () => {
    setTwofaToken('');
    setEnrollSetup(null);
    setEnrollResult(null);
    setCode('');
    setErr('');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">K</div><div className="brand-name">KJAPP</div></div>
        <div className="auth-sub">Kontrollsenter · kun for administratorer</div>

        {err && <div className="error-banner">{err}</div>}

        {enrollResult ? (
          <div>
            <div className="auth-sub" style={{ marginTop: -8 }}>
              Totrinnsbekreftelse er aktivert. Lagre reservekodene sikkert. Hver kode kan bare brukes én gang.
            </div>
            <div className="secret-box mono" style={{ textAlign: 'left', lineHeight: 1.9 }}>
              {(enrollResult.backup_codes || []).map((x: string) => <div key={x}>{x}</div>)}
            </div>
            <Btn variant="primary full" type="button" onClick={() => completeLogin(enrollResult)}>
              Jeg har lagret reservekodene
            </Btn>
          </div>
        ) : !twofaToken ? (
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
            {enrollSetup ? (
              <>
                <div className="auth-sub" style={{ marginTop: -8 }}>
                  Totrinnsbekreftelse er obligatorisk for administratorer. Skann QR-koden og bekreft første kode.
                </div>
                <div style={{ textAlign: 'center', margin: '14px 0' }}>
                  <img src={enrollSetup.qr} alt="QR-kode for totrinnsbekreftelse" width={180} height={180}
                    style={{ background: '#fff', padding: 8, borderRadius: 12 }} />
                </div>
                <div className="mono" style={{ margin: '8px 0 14px', wordBreak: 'break-all', fontSize: 12 }}>
                  {enrollSetup.secret}
                </div>
              </>
            ) : (
              <div className="auth-sub" style={{ marginTop: -8 }}>Skriv inn 6-sifret kode eller en ubrukt reservekode.</div>
            )}
            <div className="field">
              <label className="label">Verifiseringskode</label>
              <input className="input mono" inputMode="numeric" autoFocus value={code}
                onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={9}
                style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }} />
            </div>
            <Btn variant="primary full" type="submit" disabled={loading || code.length < 6}>
              {loading ? 'Verifiserer…' : enrollSetup ? 'Aktiver og bekreft' : 'Bekreft'}
            </Btn>
            <Btn variant="ghost full" type="button" style={{ marginTop: 8 }} onClick={resetChallenge}>
              Tilbake
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}
