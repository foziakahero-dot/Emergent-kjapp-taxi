import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

  return <main style={{minHeight:'100vh',background:'#050a0f',color:'#f4f8fb',fontFamily:'Inter,system-ui,sans-serif',padding:'28px 18px'}}>
    <div style={{width:'min(720px,100%)',margin:'0 auto'}}>
      <Link to="/" style={{color:'#00e5f5',textDecoration:'none',fontWeight:900,letterSpacing:'-.04em',fontSize:24}}>KJAPP</Link>
      <div style={{marginTop:56,border:'1px solid #1e313c',borderRadius:28,background:'#09131a',padding:'28px',boxShadow:'0 24px 80px rgba(0,0,0,.35)'}}>
        <div style={{fontSize:10,letterSpacing:'.18em',fontWeight:800,color:'#00e5f5'}}>DELT LIVE-TUR</div>
        {error ? <>
          <h1 style={{fontSize:30,margin:'16px 0 0'}}>Lenken er ikke tilgjengelig</h1>
          <p style={{color:'#91a3ad',lineHeight:1.6}}>{error}</p>
        </> : !trip ? <>
          <h1 style={{fontSize:30,margin:'16px 0 0'}}>Henter turstatus…</h1>
          <p style={{color:'#91a3ad'}}>Denne siden oppdateres automatisk.</p>
        </> : <>
          <h1 style={{fontSize:34,margin:'16px 0 6px'}}>{STATUS[trip.status] || 'Turstatus'}</h1>
          <p style={{color:'#91a3ad',marginTop:0}}>Oppdateres automatisk hvert 5. sekund.</p>
          <div style={{marginTop:28,display:'grid',gap:12}}>
            <div style={card}><small style={label}>HENTING</small><strong>{trip.pickup_address || '—'}</strong></div>
            <div style={card}><small style={label}>DESTINASJON</small><strong>{trip.dropoff_address || '—'}</strong></div>
            {trip.driver ? <div style={card}><small style={label}>SJÅFØR / BIL</small><strong>{trip.driver.name || 'Sjåfør'} · {trip.driver.car || 'Bil'} · {trip.driver.plate || ''}</strong></div> : null}
            {trip.driver_location ? <div style={card}><small style={label}>LIVE-POSISJON</small><strong>{Number(trip.driver_location.lat).toFixed(5)}, {Number(trip.driver_location.lng).toFixed(5)}</strong><span style={{color:'#71848f',fontSize:12}}>Sist oppdatert {new Date(trip.driver_location.updated_at || Date.now()).toLocaleTimeString('no-NO')}</span></div> : null}
          </div>
          <div style={{marginTop:22,color:'#71848f',fontSize:12,lineHeight:1.6}}>Lenken viser kun turinformasjon og sjåførens posisjon. Kundens identitet og kontaktinformasjon deles ikke. Lenken utløper automatisk.</div>
        </>}
      </div>
      <p style={{color:'#657782',fontSize:12,textAlign:'center',marginTop:24}}>Ved akutt fare: ring 112. KJAPP-support erstatter ikke nødetatene.</p>
    </div>
  </main>;
}

const card = {display:'grid',gap:6,border:'1px solid #18303c',background:'#071017',borderRadius:16,padding:'16px'} as const;
const label = {color:'#00e5f5',fontSize:9,letterSpacing:'.14em',fontWeight:800} as const;
