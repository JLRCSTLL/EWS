import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AlertGeofence } from '../../lib/geofencing';
import { demoPlaces } from '../../lib/public-demo';
import { fenceLayer } from '../operations/resident-map';

interface Props { location: { lat: number; lng: number }; area?: AlertGeofence; selectedPlace: string | null; onSelectPlace: (id: string) => void }
export function PublicMap({ location, area, selectedPlace, onSelectPlace }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelectPlace);
  select.current = onSelectPlace;
  const [state, setState] = useState('loading');
  useEffect(() => {
    if (!container.current) return;
    const current = L.map(container.current, { zoomControl: true, scrollWheelZoom: false, maxZoom: 18 });
    map.current = current;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>', maxZoom: 18 }).addTo(current);
    tiles.on('tileload', () => setState('ready'));
    tiles.on('tileerror', () => setState(value => value === 'ready' ? value : 'error'));
    const observer = new ResizeObserver(() => current.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); tiles.off(); current.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const group = L.layerGroup().addTo(current);
    if (area) fenceLayer(area, { color: '#e99436', weight: 2, fillColor: '#ffb660', fillOpacity: .12, interactive: false }).addTo(group);
    L.circleMarker([location.lat, location.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#064cf3', fillOpacity: 1 }).addTo(group).bindTooltip('Your demo location', { permanent: true, direction: 'top', offset: [0, -10] });
    for (const place of demoPlaces) {
      const text = document.createElement('span'); text.textContent = place.name + ' · sample facility';
      L.marker([place.lat, place.lng], { title: place.name, alt: place.name, icon: L.divIcon({ className: 'public-place-pin', html: '<span>+</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindTooltip(text).on('click', () => select.current(place.id)).addTo(group);
    }
    const destination = demoPlaces.find(place => place.id === selectedPlace);
    if (destination) {
      L.polyline([[location.lat, location.lng], [destination.lat, destination.lng]], { color: '#0756ee', weight: 3, dashArray: '6 7' }).addTo(group);
      current.fitBounds([[location.lat, location.lng], [destination.lat, destination.lng]], { padding: [45, 45], maxZoom: 15, animate: false });
    } else current.fitBounds([[location.lat, location.lng], ...demoPlaces.map(place => [place.lat, place.lng] as [number, number])], { padding: [40, 40], maxZoom: 13, animate: false });
    return () => { group.remove(); };
  }, [location.lat, location.lng, area, selectedPlace]);
  return <div className="public-map-wrap"><div ref={container} className="public-map" aria-label="Demo location, alert area and support facilities" /><span className="public-map-badge">DEMO LOCATIONS</span>{state !== 'ready' && <div className="public-map-notice" role="status">{state === 'loading' ? 'Loading street map…' : 'Map imagery unavailable. Demo locations are listed below.'}</div>}</div>;
}
