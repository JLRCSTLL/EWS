import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { AlertGeofence } from '../../lib/geofencing';
import { demoSnapshotAt, type Resident } from '../../lib/residents';
import { fenceLayer, residentMarker } from './resident-map';

interface Props { geofence: AlertGeofence | null; located: Resident[]; recipients: Resident[]; focusId: string | null }

export function ExposureMap({ geofence, located, recipients, focusId }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const [tileState, setTileState] = useState('loading');
  const [resetView, setResetView] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { zoomControl: true, scrollWheelZoom: true, touchZoom: true, minZoom: 5, maxZoom: 18, zoomSnap: .5 });
    mapRef.current = map;
    map.setView([14.64, 121.025], 11);
    map.attributionControl.setPrefix(false);
    let loaded = 0, errors = 0;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    });
    tiles.on('tileload', () => { loaded++; setTileState('ready'); });
    tiles.on('tileerror', () => { if (++errors > 3 && !loaded) setTileState('error'); });
    tiles.addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); map.stop(); tiles.remove(); tiles.off(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    map.closePopup();
    if (geofence) {
      const boundary = fenceLayer(geofence, { color: '#225c51', fillColor: '#417c6d', weight: 2, fillOpacity: .07, interactive: false }).addTo(layer);
      map.fitBounds(boundary.getBounds(), { padding: [25, 25], maxZoom: 15, animate: false });
    } else map.fitBounds([[14.55, 120.94], [14.73, 121.16]], { padding: [15, 15], animate: false });
    return () => { layer.remove(); };
  }, [geofence, resetView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const ids = new Set(recipients.map(user => user.id));
    markers.current.clear();
    located.forEach(user => {
      const marker = residentMarker(user, demoSnapshotAt, { muted: !ids.has(user.id) });
      if (marker) { marker.addTo(layer); markers.current.set(user.id, marker); }
    });
    return () => { layer.remove(); markers.current.clear(); };
  }, [located, recipients]);

  useEffect(() => {
    if (!focusId) return;
    const marker = markers.current.get(focusId);
    if (marker) { mapRef.current?.setView(marker.getLatLng(), 15, { animate: false }); marker.openPopup(); }
  }, [focusId, located, recipients]);

  return <div className="ops-exposure-map-wrap">
    <div ref={container} className="ops-exposure-map" aria-label="Recipient location preview map. Scroll or pinch to zoom." />
    <button className="ops-reset-preview" onClick={() => setResetView(current => current + 1)}>Show entire area</button>
    {tileState !== 'ready' && <span className="ops-exposure-map-notice" role="status">{tileState === 'loading' ? 'Loading street map…' : 'Map imagery unavailable. Recipient locations are listed below.'}</span>}
  </div>;
}
