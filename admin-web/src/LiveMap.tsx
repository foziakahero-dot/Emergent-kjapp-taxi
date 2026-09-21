import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type DriverPosition = {
  id: string;
  name?: string;
  car?: string;
  plate?: string;
  lat: number;
  lng: number;
  last_location_at?: string;
  status?: 'online' | 'stale' | 'offline';
};

function FitDrivers({ drivers }: { drivers: DriverPosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (drivers.length === 1) map.setView([drivers[0].lat, drivers[0].lng], 13);
    else if (drivers.length > 1) map.fitBounds(drivers.map((d) => [d.lat, d.lng] as [number, number]), { padding: [36, 36], maxZoom: 13 });
  }, [drivers, map]);
  return null;
}

export default function LiveMap({ drivers }: { drivers: DriverPosition[] }) {
  const mapTilerKey = String((import.meta as any).env?.VITE_MAPTILER_KEY || '').trim();
  return (
    <div className="live-map-wrap">
      <MapContainer center={[59.9139, 10.7522]} zoom={11} scrollWheelZoom={false} className="live-map">
        <TileLayer
          url={`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}@2x.png?key=${encodeURIComponent(mapTilerKey)}`}
          attribution='&copy; MapTiler &middot; OpenStreetMap contributors'
        />
        <FitDrivers drivers={drivers} />
        {drivers.map((driver) => (
          <CircleMarker key={driver.id} center={[driver.lat, driver.lng]} radius={9}
            pathOptions={{ color: '#081116', fillColor: driver.status === 'online' ? '#34d399' : driver.status === 'stale' ? '#f5b301' : '#7c8894', fillOpacity: 1, weight: 3 }}>
            <Popup><strong>{driver.name || 'Sjåfør'}</strong><br />{driver.car || 'Ukjent bil'} {driver.plate || ''}<br />Status: {driver.status === 'online' ? 'Online' : driver.status === 'stale' ? 'Utdatert GPS' : 'Offline'}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {!drivers.length && <div className="live-map-empty">Ingen sjåfører har registrert posisjon ennå</div>}
      {!mapTilerKey && <div className="live-map-empty" style={{ top: 'auto', bottom: 16 }}>MAPTILER-nøkkel mangler i admin-web</div>}
    </div>
  );
}
