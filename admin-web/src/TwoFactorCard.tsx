import React, { useState } from 'react';
import { api, apiError } from './api';
import { Btn, Card, Loader, Pill, useAsync } from './ui';

export default function TwoFactorCard({ onComplete }: { onComplete?: () => void }) {
  const status = useAsync(() => api.twofaStatus(), []);
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const begin = async () => {
    setBusy(true); setMsg(''); setBackupCodes([]);
    try { setSetup(await api.twofaSetup()); }
    catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };
  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      const result = await api.twofaEnable(code.trim());
      if (result?.enabled !== true || !Array.isArray(result.backup_codes) || !result.backup_codes.length) {
        throw new Error('Aktiveringen kunne ikke bekreftes. Logg inn på nytt for å kontrollere status.');
      }
      setBackupCodes(result.backup_codes || []);
      setSetup(null); setCode(''); setMsg('Totrinnsbekreftelse er aktivert. Lagre reservekodene trygt.');
      status.setData({ ...status.data, enabled: true });
    } catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true); setMsg('');
    try {
      await api.twofaDisable(password, code.trim());
      setPassword(''); setCode(''); setMsg('Totrinnsbekreftelse er deaktivert.');
      status.reload();
    } catch (e) { setMsg(apiError(e)); }
    finally { setBusy(false); }
  };

  if (status.err) return <Card><div className="error-banner" role="alert">{status.err}</div><Btn onClick={status.reload}>Prøv igjen</Btn></Card>;

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <div className="section-title" style={{ marginTop: 0 }}>Kontosikkerhet</div>
      {status.loading ? <Loader /> : status.data?.enabled ? (
        <>
          <Pill status="completed" label="Totrinnsbekreftelse aktiv" />
          <div className="dim" style={{ margin: '12px 0' }}>Passord, autentiseringskode og engangskoder beskytter administratorkontoen.</div>
          {!status.data?.required && <><div className="grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 620 }}>
            <div className="field"><label className="label">Nåværende passord</label>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="field"><label className="label">Kode fra autentiseringsappen</label>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={9} onChange={(e) => setCode(e.target.value)} /></div>
          </div>
          <Btn onClick={disable} disabled={busy || !password || !code}>{busy ? 'Arbeider…' : 'Deaktiver 2FA'}</Btn></>}
        </>
      ) : setup ? (
        <>
          <div className="dim" style={{ marginBottom: 12 }}>Åpne Google Authenticator, Microsoft Authenticator eller en annen autentiseringsapp. Legg til konto, skann QR-koden og skriv inn den seks-sifrede koden. Du kan også legge inn oppsettnøkkelen manuelt.</div>
          <img src={setup.qr} alt="QR-kode for totrinnsbekreftelse" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 12 }} />
          <div className="mono" style={{ margin: '10px 0 14px', wordBreak: 'break-all' }}>{setup.secret}</div>
          <div className="field" style={{ maxWidth: 320 }}><label className="label" htmlFor="twofa-confirm">Bekreftelseskode</label>
            <input id="twofa-confirm" className="input mono" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
          <Btn variant="primary" onClick={enable} disabled={busy || !/^[0-9]{6}$/.test(code)}>{busy ? 'Aktiverer…' : 'Aktiver 2FA'}</Btn>
        </>
      ) : (
        <>
          <Pill status="pending" label="Totrinnsbekreftelse er ikke aktiv" />
          <div className="dim" style={{ margin: '12px 0' }}>Aktiver 2FA før panelet brukes med produksjonsdata.</div>
          <Btn variant="primary" onClick={begin} disabled={busy}>{busy ? 'Klargjør…' : 'Sett opp 2FA'}</Btn>
        </>
      )}
      {backupCodes.length > 0 && <div style={{ marginTop: 18 }}>
        <div className="strong">Reservekoder – vises bare nå</div>
        <div className="mono" style={{ marginTop: 8, lineHeight: 1.8 }}>{backupCodes.join('  ·  ')}</div>
      </div>}
      {onComplete && status.data?.enabled && backupCodes.length > 0 && <Btn variant="primary" onClick={onComplete}>Jeg har lagret reservekodene – logg inn på nytt</Btn>}
      {msg && <div className={msg.includes('aktivert') || msg.includes('deaktivert') ? 'dim' : 'error-banner'} style={{ marginTop: 12 }}>{msg}</div>}
    </Card>
  );
}
