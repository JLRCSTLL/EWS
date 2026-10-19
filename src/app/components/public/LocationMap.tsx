import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LiveUser } from '../../lib/live-model';
import type { AlertGeofence } from '../../lib/geofencing';
import { fenceLayer } from '../operations/resident-map';

export function LocationMap({ location, areas = [] }: { location: LiveUser['location']; areas?: AlertGeofence[] }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!element.current) return;
    const current = L.map(element.current, { scrollWheelZoom: true, maxZoom: 18 }).setView([14.6,121.02],11);
    map.current = current;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(current);
    const observer = new ResizeObserver(() => current.invalidateSize()); observer.observe(element.current);
    return () => { observer.disconnect(); current.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const current = map.current; if (!current) return;
    const layer = L.layerGroup().addTo(current);
    for (const area of areas) fenceLayer(area, { color: '#e59537', weight: 2, fillOpacity: .08 }).addTo(layer);
    if (location) {
      L.circle([location.lat,location.lng], { radius: location.accuracy, color: '#145be8', weight: 1, fillOpacity: .12 }).addTo(layer);
      L.circleMarker([location.lat,location.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#145be8', fillOpacity: 1 }).addTo(layer).bindTooltip('Your last shared location');
      current.setView([location.lat,location.lng],15,{ animate: false });
    } else if (areas[0]) current.fitBounds(fenceLayer(areas[0]).getBounds(), { padding: [25,25], maxZoom: 14 });
    return () => { layer.remove(); };
  }, [location?.lat,location?.lng,location?.accuracy,areas.map(a => a.id).join(',')]);
  return <div ref={element} className="el-location-map" aria-label="Your shared location and alert areas" />;
}
