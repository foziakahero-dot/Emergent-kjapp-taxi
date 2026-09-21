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
  location_state?: 'fresh_online' | 'stale_online' | 'offline_with_last_location';
};

function FitDrivers({ drivers }: { drivers: DriverPosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (drivers.length === 1) map.setView([drivers[0].lat, drivers[0].lng], 13);
    else if (drivers.length > 1) map.fitBounds(drivers.map((d) => [d.lat, d.lng] as [number, number]), { padding: [36, 36], maxZoom: 13 });
  }, [drivers, map]);
  return null;
}

function markerStyle(state?: DriverPosition['location_state']) {
  if (state === 'stale_online') return { radius: 8, color: '#4a3510', fillColor: '#f5b942', fillOpacity: .82, weight: 2 };
  if (state === 'offline_with_last_location') return { radius: 7, color: '#334155', fillColor: '#94a3b8', fillOpacity: .42, weight: 2 };
  return { radius: 9, color: '#06222a', fillColor: '#72dce8', fillOpacity: 1, weight: 3 };
}

function stateLabel(state?: DriverPosition['location_state']) {
  if (state === 'stale_online') return 'Online · utdatert GPS';
  if (state === 'offline_with_last_location') return 'Offline · siste kjente posisjon';
  return 'Online · fersk GPS';
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
        {drivers.map((driver) => {
          const style = markerStyle(driver.location_state);
          return (
            <CircleMarker key={driver.id} center={[driver.lat, driver.lng]} radius={style.radius}
              pathOptions={{ color: style.color, fillColor: style.fillColor, fillOpacity: style.fillOpacity, weight: style.weight }}>
              <Popup>
                <strong>{driver.name || 'Sjåfør'}</strong><br />
                {driver.car || 'Ukjent bil'} {driver.plate || ''}<br />
                <span>{stateLabel(driver.location_state)}</span>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {!drivers.length && <div className="live-map-empty">Ingen registrerte GPS-posisjoner</div>}
    </div>
  );
}
