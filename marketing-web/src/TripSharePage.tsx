import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Brand } from './SnarUI';
import { getSharedTrip } from './api';

const STATUS: Record<string,string> = {
  searching: 'Søker etter sjåfør',
  booking: 'Bestilling pågår',
  driver_on_way: 'Sjåføren er på vei',
  at_pickup: 'Sjåføren er fremme',
  in_trip: 'Turen pågår',
  arrived: 'Fremme',
  completed: 'Turen er fullført',
  rated: 'Turen er fullført',
  cancelled: 'Turen er avbrutt',
  cancelled_by_driver: 'Turen er avbrutt',
};

export function TripSharePage() {
  const { token = '' } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getSharedTrip(token);
        if (active) { setTrip(data); setError(''); }
      } catch (e: any) {
        if (active) setError(e?.message || 'Kunne ikke åpne turen');
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  return <main style={{minHeight:'100vh',background:'var(--snar-surface)',color:'var(--snar-navy)',fontFamily:'var(--snar-font)',padding:'28px 18px'}}>
    <div style={{width:'min(720px,100%)',margin:'0 auto'}}>
      <Brand />
      <div style={{marginTop:56,border:'1px solid var(--snar-line)',borderRadius:24,background:'var(--snar-surface)',padding:'28px',boxShadow:'0 24px 80px rgba(0,31,63,.08)'}}>
        <div style={{fontSize:10,letterSpacing:'.18em',fontWeight:800,color:'var(--snar-red-deep)'}}>DELT LIVE-TUR</div>
        {error ? <>
          <h1 style={{fontSize:30,margin:'16px 0 0'}}>Lenken er ikke tilgjengelig</h1>
          <p style={{color:'var(--snar-secondary)',lineHeight:1.6}}>{error}</p>
        </> : !trip ? <>
          <h1 style={{fontSize:30,margin:'16px 0 0'}}>Henter turstatus…</h1>
          <p style={{color:'var(--snar-secondary)'}}>Denne siden oppdateres automatisk.</p>
        </> : <>
          <h1 style={{fontSize:34,margin:'16px 0 6px'}}>{STATUS[trip.status] || 'Turstatus'}</h1>
          <p style={{color:'var(--snar-secondary)',marginTop:0}}>Oppdateres automatisk hvert 5. sekund.</p>
          <div style={{marginTop:28,display:'grid',gap:12}}>
            <div style={card}><small style={label}>HENTING</small><strong>{trip.pickup_address || '—'}</strong></div>
            <div style={card}><small style={label}>DESTINASJON</small><strong>{trip.dropoff_address || '—'}</strong></div>
            {trip.driver ? <div style={card}><small style={label}>SJÅFØR / BIL</small><strong>{trip.driver.name || 'Sjåfør'} · {trip.driver.car || 'Bil'} · {trip.driver.plate || ''}</strong></div> : null}
            {trip.driver_location ? <div style={card}><small style={label}>LIVE-POSISJON</small><strong>{Number(trip.driver_location.lat).toFixed(5)}, {Number(trip.driver_location.lng).toFixed(5)}</strong><span style={{color:'var(--snar-secondary)',fontSize:12}}>Sist oppdatert {new Date(trip.driver_location.updated_at || Date.now()).toLocaleTimeString('no-NO')}</span></div> : null}
          </div>
          <div style={{marginTop:22,color:'var(--snar-secondary)',fontSize:12,lineHeight:1.6}}>Lenken viser kun turinformasjon og sjåførens posisjon. Kundens identitet og kontaktinformasjon deles ikke. Lenken utløper automatisk.</div>
        </>}
      </div>
      <p style={{color:'var(--snar-secondary)',fontSize:12,textAlign:'center',marginTop:24}}>Ved akutt fare: ring 112. SNAR-support erstatter ikke nødetatene.</p>
    </div>
  </main>;
}

const card = {display:'grid',gap:6,border:'1px solid var(--snar-line)',background:'var(--snar-surface)',borderRadius:18,padding:'16px'} as const;
const label = {color:'var(--snar-red-deep)',fontSize:9,letterSpacing:'.14em',fontWeight:800} as const;

