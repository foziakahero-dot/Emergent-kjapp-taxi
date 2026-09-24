import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FleetLiveDriver } from './api';

const OSLO: [number, number] = [59.9139, 10.7522];

function statusMeta(status?: string) {
  switch (status) {
    case 'available': return { label: 'Ledig', color: '#34d399' };
    case 'driver_on_way': return { label: 'På vei til kunde', color: '#fbbf24' };
    case 'at_pickup': return { label: 'Ved hentested', color: '#f59e0b' };
    case 'in_trip': return { label: 'På tur', color: '#60a5fa' };
    case 'gps_stale': return { label: 'GPS utløpt', color: '#94a3b8' };
    default: return { label: 'Offline', color: '#64748b' };
  }
}

function safe(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[ch] || ch));
}

export function FleetMap({ drivers }: { drivers: FleetLiveDriver[] }) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const instance = L.map(el.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(OSLO, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(instance);
    const group = L.layerGroup().addTo(instance);
    map.current = instance;
    markers.current = group;

    const resize = window.setTimeout(() => instance.invalidateSize(), 0);
    return () => {
      window.clearTimeout(resize);
      instance.remove();
      map.current = null;
      markers.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = markers.current;
    if (!instance || !group) return;
    group.clearLayers();

    const visible = drivers.filter((d) =>
      d.online && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng))
    );
    const bounds: L.LatLngExpression[] = [];

    for (const driver of visible) {
      const lat = Number(driver.lat);
      const lng = Number(driver.lng);
      bounds.push([lat, lng]);
      const meta = statusMeta(driver.operational_status);
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color: meta.color,
        fillColor: meta.color,
        fillOpacity: driver.gps_fresh ? 0.95 : 0.42,
        weight: 2,
      });
      const last = driver.last_location_at
        ? new Date(driver.last_location_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'ukjent';
      marker.bindPopup(
        '<div class="fleet-map-popup">' +
        '<strong>' + safe(driver.name || 'Sjåfør') + '</strong>' +
        '<span>' + safe([driver.car, driver.plate].filter(Boolean).join(' · ') || 'Ingen bil') + '</span>' +
        '<span>' + safe(meta.label) + '</span>' +
        '<small>Sist GPS: ' + safe(last) + '</small>' +
        (driver.active_trip_id ? '<small>Aktiv tur: ' + safe(driver.active_trip_id.slice(0, 8)) + '</small>' : '') +
        '</div>'
      );
      marker.addTo(group);
    }

    if (!fitted.current && bounds.length) {
      if (bounds.length === 1) instance.setView(bounds[0] as L.LatLngExpression, 13);
      else instance.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
      fitted.current = true;
    }
  }, [drivers]);

  return <div ref={el} className="fleet-real-map" aria-label="Live kart over egne KJAPP-biler" />;
}
