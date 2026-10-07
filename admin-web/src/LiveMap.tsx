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
  return (
    <div className="live-map-wrap">
      <MapContainer center={[59.9139, 10.7522]} zoom={11} scrollWheelZoom={false} className="live-map">
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitDrivers drivers={drivers} />
        {drivers.map((driver) => (
          <CircleMarker key={driver.id} center={[driver.lat, driver.lng]} radius={9}
            pathOptions={{ color: '#001f3f', fillColor: '#ff0000', fillOpacity: 1, weight: 3 }}>
            <Popup><strong>{driver.name || 'Sjåfør'}</strong><br />{driver.car || 'Ukjent bil'} {driver.plate || ''}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {!drivers.length && <div className="live-map-empty">Ingen ferske GPS-posisjoner</div>}
    </div>
  );
}

