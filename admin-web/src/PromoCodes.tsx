import React, { useState } from 'react';
import { api, apiError } from './api';
import { Btn, Empty, ErrorBanner, Kpi, Loader, Modal, PageHead, Pill, fmtDate, fmtMoney, useAsync } from './ui';

type PromoCode = {
  id: string; code: string; label?: string; credit_kr: number; max_redemptions?: number | null;
  expires_at?: string | null; new_customers_only: boolean; active: boolean;
  redemptions_count: number; granted_kr: number;
};

export function PromoCodes() {
  const { data, loading, err, reload } = useAsync<any>(() => api.get('/admin/promo-codes').then((r) => r.data), []);
  const [creating, setCreating] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const codes: PromoCode[] = data?.codes || [];
  const totals = data?.totals || {};

  const toggle = async (c: PromoCode) => {
    setActionErr('');
    try {
      await api.patch(`/admin/promo-codes/${c.id}`, { active: !c.active });
      reload();
    } catch (e) { setActionErr(apiError(e)); }
  };

  return (
    <>
      <PageHead title="Kampanjekoder" sub="Kundekreditt finansieres av SNAR-provisjonen. Sjåfør og løyvehaver får full tur."
        right={<Btn variant="primary" onClick={() => setCreating(true)}>Ny kode</Btn>} />
      <ErrorBanner msg={err || actionErr} />
      <div className="kpi-grid">
        <Kpi label="Utdelt kreditt" value={fmtMoney(totals.granted_kr || 0)} icon="gift" />
        <Kpi label="Brukt på turer" value={fmtMoney(totals.spent_kr || 0)} icon="trending" accent />
        <Kpi label="Ubrukt saldo hos kunder" value={fmtMoney(totals.outstanding_kr || 0)} icon="wallet" />
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Kode</th><th>Beskrivelse</th><th>Kreditt</th><th>Innløst</th><th>Gjelder</th><th>Utløper</th><th>Status</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><Loader /></td></tr> : codes.length ? codes.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td className="dim">{c.label || '—'}</td>
                <td>{fmtMoney(c.credit_kr)}</td>
                <td>{c.redemptions_count}{c.max_redemptions ? ` / ${c.max_redemptions}` : ''}</td>
                <td className="dim">{c.new_customers_only ? 'Nye kunder' : 'Alle kunder'}</td>
                <td className="dim nowrap">{c.expires_at ? fmtDate(c.expires_at) : 'Aldri'}</td>
                <td><Pill status={c.active ? 'active' : 'inactive'} label={c.active ? 'Aktiv' : 'Pauset'} /></td>
                <td><Btn variant="ghost sm" onClick={() => toggle(c)}>{c.active ? 'Pause' : 'Aktiver'}</Btn></td>
              </tr>
            )) : <tr><td colSpan={8}><Empty title="Ingen kampanjekoder ennå" /></td></tr>}
          </tbody>
        </table>
      </div>
      {creating && <CreatePromoModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} />}
    </>
  );
}

function CreatePromoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [credit, setCredit] = useState('100');
  const [max, setMax] = useState('300');
  const [expires, setExpires] = useState('');
  const [newOnly, setNewOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/admin/promo-codes', {
        code, label, credit_kr: Number(credit),
        max_redemptions: max ? Number(max) : null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        new_customers_only: newOnly, active: true,
      });
      onDone();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Ny kampanjekode" sub="Kunden legger inn koden under Lommebok. Kreditten trekkes fra SNARs andel av turen." onClose={onClose}>
      <form onSubmit={submit} className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ErrorBanner msg={err} />
        <label>Kode<input className="input mono" required minLength={3} maxLength={24} value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="SNAR100" /></label>
        <label>Beskrivelse<input className="input" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lansering Oslo" /></label>
        <label>Kreditt (kr)<input className="input" type="number" min={10} max={1000} required value={credit} onChange={(e) => setCredit(e.target.value)} /></label>
        <label>Maks antall innløsninger<input className="input" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} placeholder="Ubegrenset" /></label>
        <label>Utløpsdato<input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} /> Bare nye kunder (ingen fullførte turer)
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Avbryt</Btn>
          <Btn variant="primary" type="submit" disabled={busy || code.length < 3}>{busy ? 'Lagrer…' : 'Opprett'}</Btn>
        </div>
      </form>
    </Modal>
  );
}
