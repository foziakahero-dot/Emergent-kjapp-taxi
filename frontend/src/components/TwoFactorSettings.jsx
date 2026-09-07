import React, { useEffect, useState } from "react";
import { authApi, formatApiErrorDetail } from "../lib/api";
import { ShieldCheck, ShieldAlert, Loader2, Copy, Check } from "lucide-react";

const CARD = { background: "rgba(244,244,240,0.03)", border: "1px solid var(--line)" };

export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [setup, setSetup] = useState(null); // { qr, secret, otpauth_url }
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [pw, setPw] = useState("");
  const [disCode, setDisCode] = useState("");

  const load = () => authApi.twofaStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
  useEffect(() => { load(); }, []);

  const startSetup = async () => {
    setBusy(true); setErr("");
    try { setSetup(await authApi.twofaSetup()); }
    catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke starte 2FA"); }
    finally { setBusy(false); }
  };

  const confirmEnable = async () => {
    setBusy(true); setErr("");
    try {
      const res = await authApi.twofaEnable(code.trim());
      setBackupCodes(res.backup_codes || []);
      setSetup(null); setCode("");
      await load();
    } catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || "Feil kode"); }
    finally { setBusy(false); }
  };

  const confirmDisable = async () => {
    setBusy(true); setErr("");
    try {
      await authApi.twofaDisable(pw, disCode.trim());
      setDisabling(false); setPw(""); setDisCode(""); setBackupCodes(null);
      await load();
    } catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail) || "Kunne ikke deaktivere"); }
    finally { setBusy(false); }
  };

  const copyBackup = () => {
    if (!backupCodes) return;
    navigator.clipboard?.writeText(backupCodes.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (!status) return null;
  const enabled = status.enabled;

  return (
    <div className="rounded-2xl p-5" style={CARD} data-testid="twofa-card">
      <div className="text-[10px] uppercase tracking-[0.28em] mb-1" style={{ color: "var(--accent)" }}>Sikkerhet</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="font-display text-[17px]" style={{ color: "var(--text)" }}>To-trinns verifisering (2FA)</div>
        {enabled ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(47,224,140,0.14)", color: "#2fe08c" }} data-testid="twofa-status-enabled">
            <ShieldCheck size={12} /> Aktivert
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(215,106,90,0.14)", color: "#d76a5a" }} data-testid="twofa-status-disabled">
            <ShieldAlert size={12} /> Ikke aktivert
          </span>
        )}
      </div>
      <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>
        Beskytt admin-kontoen din med en autentiserings-app (Google Authenticator, 1Password, Authy).
      </p>

      {err && <div className="text-[12px] mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(215,106,90,0.1)", color: "#d76a5a" }} data-testid="twofa-error">{err}</div>}

      {/* Backup codes just generated */}
      {backupCodes && (
        <div className="rounded-xl p-4 mb-3" style={{ background: "rgba(47,224,140,0.06)", border: "1px solid rgba(47,224,140,0.2)" }} data-testid="twofa-backup-codes">
          <div className="text-[13px] mb-2" style={{ color: "var(--text)" }}>Lagre disse backup-kodene på et trygt sted. Hver kan brukes én gang.</div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[13px]" style={{ color: "var(--text)" }}>
            {backupCodes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
          </div>
          <button onClick={copyBackup} className="mt-3 inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg" style={{ border: "1px solid var(--line)", color: "var(--text)" }} data-testid="twofa-copy-backup">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Kopiert" : "Kopier alle"}
          </button>
        </div>
      )}

      {/* Setup flow (scanning) */}
      {!enabled && setup && (
        <div className="space-y-3" data-testid="twofa-setup">
          <div className="flex items-start gap-4">
            <img src={setup.qr} alt="2FA QR" width={148} height={148} className="rounded-xl bg-white p-1" data-testid="twofa-qr" />
            <div className="flex-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              <div className="mb-2">Skann QR-koden, eller skriv inn nøkkelen manuelt:</div>
              <code className="block break-all px-2 py-1.5 rounded-lg font-mono text-[11px]" style={{ background: "rgba(0,0,0,0.3)", color: "var(--text)" }} data-testid="twofa-secret">{setup.secret}</code>
            </div>
          </div>
          <input
            value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="6-sifret kode" inputMode="numeric" maxLength={6}
            className="w-full px-3 py-2.5 rounded-xl text-[15px] outline-none bg-transparent tracking-[0.3em] text-center"
            style={{ border: "1px solid var(--line)", color: "var(--text)" }}
            data-testid="twofa-enable-code"
          />
          <div className="flex gap-2">
            <button onClick={confirmEnable} disabled={busy || code.length < 6} data-testid="twofa-enable-confirm"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-50" style={{ background: "var(--accent)", color: "#0B1013" }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Bekreft og aktiver
            </button>
            <button onClick={() => { setSetup(null); setCode(""); setErr(""); }} className="px-4 py-2.5 rounded-xl text-[14px]" style={{ border: "1px solid var(--line)", color: "var(--text-muted)" }} data-testid="twofa-setup-cancel">Avbryt</button>
          </div>
        </div>
      )}

      {/* Not enabled, no active setup */}
      {!enabled && !setup && (
        <button onClick={startSetup} disabled={busy} data-testid="twofa-enable-start"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-50" style={{ background: "var(--accent)", color: "#0B1013" }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Aktiver 2FA
        </button>
      )}

      {/* Enabled → disable flow */}
      {enabled && !disabling && (
        <button onClick={() => { setDisabling(true); setErr(""); }} data-testid="twofa-disable-start"
          className="px-5 py-2.5 rounded-xl text-[14px]" style={{ border: "1px solid var(--line)", color: "#d76a5a" }}>
          Deaktiver 2FA
        </button>
      )}
      {enabled && disabling && (
        <div className="space-y-2 max-w-sm" data-testid="twofa-disable">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passord"
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none bg-transparent" style={{ border: "1px solid var(--line)", color: "var(--text)" }} data-testid="twofa-disable-password" />
          <input value={disCode} onChange={(e) => setDisCode(e.target.value)} placeholder="2FA-kode eller backup-kode" inputMode="text"
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none bg-transparent" style={{ border: "1px solid var(--line)", color: "var(--text)" }} data-testid="twofa-disable-code" />
          <div className="flex gap-2">
            <button onClick={confirmDisable} disabled={busy} data-testid="twofa-disable-confirm"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-50" style={{ background: "#d76a5a", color: "#0B1013" }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Bekreft deaktivering
            </button>
            <button onClick={() => { setDisabling(false); setPw(""); setDisCode(""); setErr(""); }} className="px-4 py-2.5 rounded-xl text-[14px]" style={{ border: "1px solid var(--line)", color: "var(--text-muted)" }} data-testid="twofa-disable-cancel">Avbryt</button>
          </div>
        </div>
      )}
    </div>
  );
}
