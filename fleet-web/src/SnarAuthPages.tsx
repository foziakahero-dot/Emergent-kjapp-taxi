import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from './api';
import { useAuth } from './auth';
import { Brand } from './App';

function ErrorBox({ message }: { message: string }) {
  return message ? <div className="error-box">{message}</div> : null;
}

function Loading() {
  return <div className="page-loading"><div className="spinner" /></div>;
}

export function SnarLoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (error: any) {
      setErr(error?.message || apiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen snar-login-screen">
      <div className="login-copy">
        <Brand />
        <div className="login-copy-main">
          <h1>Hele flåten.<br />Ett sted.</h1>
          <p>Følg driften live, administrer sjåfører og kjøretøy, og hold oversikt over turer og oppgjør i SNAR Fleet.</p>
        </div>
        <div className="login-domain">SNAR Fleet · Oslo beta</div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-card-kicker">PARTNERPORTAL</div>
        <h2>Velkommen tilbake</h2>
        <p>For godkjente løyvehavere og flåtepartnere</p>
        <label className="sr-only" htmlFor="fleet-email">E-post</label>
        <input id="fleet-email" type="email" autoComplete="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="sr-only" htmlFor="fleet-password">Passord</label>
        <input id="fleet-password" type="password" autoComplete="current-password" placeholder="Passord" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorBox message={err} />
        <button className="primary-button" disabled={busy}>{busy ? 'Logger inn…' : 'Logg inn'}</button>
        <Link to="/glemt-passord" className="text-link">Glemt passord?</Link>
        <div className="approval-note">Tilgang aktiveres når SNAR har godkjent løyvehaverkontoen og nødvendig dokumentasjon.</div>
      </form>
    </div>
  );
}

export function SnarForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api.forgotPassword(email.trim()); } catch { /* keep response intentionally identical */ }
    setSent(true);
    setBusy(false);
  };

  return (
    <div className="auth-simple">
      <Brand />
      <div className="auth-simple-card">
        <div className="login-card-kicker">SNAR FLEET</div>
        <h1>Glemt passord</h1>
        {sent ? (
          <>
            <p>Hvis e-posten finnes hos SNAR, har vi sendt en lenke for å velge nytt passord.</p>
            <Link className="primary-button link-button" to="/login">Tilbake til innlogging</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Skriv inn e-posten som er knyttet til den godkjente løyvehaverkontoen.</p>
            <input type="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="primary-button" disabled={busy}>{busy ? 'Sender…' : 'Send lenke'}</button>
            <Link className="text-link" to="/login">Tilbake</Link>
          </form>
        )}
      </div>
    </div>
  );
}

export function SnarResetPasswordPage() {
  const { token = '' } = useParams();
  const [state, setState] = useState<'checking'|'invalid'|'form'|'done'>('checking');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.checkResetToken(token).then(() => setState('form')).catch(() => setState('invalid'));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 6) return setErr('Passord må ha minst 6 tegn');
    if (pw !== pw2) return setErr('Passordene er ikke like');
    setBusy(true);
    try {
      await api.resetPassword(token, pw);
      setState('done');
    } catch (error) {
      setErr(apiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-simple">
      <Brand />
      <div className="auth-simple-card">
        <div className="login-card-kicker">SNAR FLEET</div>
        {state === 'checking' ? <Loading /> : null}
        {state === 'invalid' ? <><h1>Lenken virker ikke</h1><p>Lenken er ugyldig eller utløpt.</p><Link className="primary-button link-button" to="/glemt-passord">Be om ny lenke</Link></> : null}
        {state === 'form' ? (
          <form onSubmit={submit}>
            <h1>Velg nytt passord</h1>
            <p>Bruk det nye passordet neste gang du logger inn i SNAR Fleet.</p>
            <input type="password" placeholder="Nytt passord" value={pw} onChange={(e) => setPw(e.target.value)} required />
            <input type="password" placeholder="Gjenta nytt passord" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            <ErrorBox message={err} />
            <button className="primary-button" disabled={busy}>{busy ? 'Lagrer…' : 'Lagre nytt passord'}</button>
          </form>
        ) : null}
        {state === 'done' ? <><h1>Passordet er endret</h1><p>Du kan nå logge inn i SNAR Fleet.</p><Link className="primary-button link-button" to="/login">Logg inn</Link></> : null}
      </div>
    </div>
  );
}

export function SnarForcePasswordChangePage() {
  const { completePasswordChange, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Passord må ha minst 8 tegn');
    if (pw !== pw2) return setErr('Passordene er ikke like');
    setBusy(true);
    try {
      const res = await api.changePassword(current, pw);
      completePasswordChange(res.token);
    } catch (error) {
      setErr(apiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-simple">
      <Brand />
      <div className="auth-simple-card">
        <div className="login-card-kicker">SNAR FLEET</div>
        <form onSubmit={submit}>
          <h1>Bytt midlertidig passord</h1>
          <p>Kontoen ble opprettet med et midlertidig passord. Velg et eget passord før du går videre.</p>
          <input type="password" autoComplete="current-password" placeholder="Midlertidig passord" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <input type="password" autoComplete="new-password" placeholder="Nytt passord (minst 8 tegn)" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <input type="password" autoComplete="new-password" placeholder="Gjenta nytt passord" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          <ErrorBox message={err} />
          <button className="primary-button" disabled={busy}>{busy ? 'Lagrer…' : 'Lagre og fortsett'}</button>
          <button type="button" className="link-button" onClick={logout}>Logg ut</button>
        </form>
      </div>
    </div>
  );
}
