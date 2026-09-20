import React, { useEffect, useMemo, useState } from 'react';
import { apiError, http } from './api';
import { Btn, Card, Drawer, ErrorBanner, KV, Loader, Pill, fmtDate } from './ui';

const encodePath = (path: string) =>
  String(path || '').split('/').map((part) => encodeURIComponent(part)).join('/');

export function DocumentFile({ path, filename, onViewed }: any) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const open = async () => {
    setBusy(true); setErr('');
    try {
      const response = await http.get(`/files/${encodePath(path)}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      onViewed?.();
    } catch (error) {
      setErr(apiError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="strong">{filename || 'Dokument'}</div>
      <div className="cell-sub" style={{ marginBottom: 10 }}>Dokumentet må åpnes før det kan godkjennes.</div>
      <Btn variant="primary" onClick={open} disabled={busy || !path}>{busy ? 'Åpner…' : 'Åpne dokument'}</Btn>
      <ErrorBanner msg={err} />
    </Card>
  );
}

export function PersonDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let active = true;
    http.get(`/admin/users/${id}`).then((r) => { if (active) setData(r.data); })
      .catch((e) => { if (active) setErr(apiError(e)); });
    return () => { active = false; };
  }, [id]);
  return (
    <Drawer title={data?.fullName || 'Brukerdetaljer'} onClose={onClose}>
      <ErrorBanner msg={err} />
      {!data && !err ? <Loader /> : data ? <>
        <KV k="E-post" v={data.email} />
        <KV k="Telefon" v={data.phone || '—'} />
        <KV k="Rolle" v={data.role} />
        <KV k="Status" v={<Pill status={data.disabled ? 'cancelled' : 'completed'} label={data.disabled ? 'Deaktivert' : 'Aktiv'} />} />
        <KV k="Fullførte turer" v={data.trips_completed ?? 0} />
        <KV k="Rating" v={data.rating ? `${data.rating} ★` : 'Ikke vurdert'} />
        <KV k="Kvalitet" v={data.quality_status || 'Ikke kontrollert'} />
        <KV k="Siste fullførte tur" v={fmtDate(data.last_completed_at)} />
        {data.suspension_reason ? <Card style={{ marginTop: 14 }}><div className="label">Begrunnelse</div>{data.suspension_reason}</Card> : null}
      </> : null}
    </Drawer>
  );
}

export function LiveMap({ data }: any) {
  const points = useMemo(() => (data?.drivers || []).filter((d: any) => d.lat != null && d.lng != null), [data]);
  if (!points.length) return null;
  const lats = points.map((p: any) => Number(p.lat));
  const lngs = points.map((p: any) => Number(p.lng));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pos = (p: any) => ({
    left: `${8 + ((Number(p.lng) - minLng) / Math.max(.001, maxLng - minLng)) * 84}%`,
    top: `${8 + (1 - (Number(p.lat) - minLat) / Math.max(.001, maxLat - minLat)) * 84}%`,
  });
  return (
    <Card className="live-map">
      <div className="live-map-grid" aria-label={`Kartoversikt med ${points.length} sjåfører`}>
        {points.map((p: any) => <div key={p.id} className="live-map-point" style={pos(p)} title={`${p.name} · ${p.plate || ''}`}><span /></div>)}
      </div>
      <div className="cell-sub">Live GPS-posisjoner · {points.length} sjåfører med gyldig posisjon</div>
    </Card>
  );
}

export function Security() {
  return <Card><div className="strong">Tilgangskontroll</div><div className="cell-sub">Adminhandlinger krever innlogging og loggføres.</div></Card>;
}
