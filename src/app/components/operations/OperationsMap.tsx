import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { infrastructureSites, responderTeams, type DisasterEvent } from '../../lib/dashboard-data';
import { getSelection, severityColors, type MapLayers, type MapSelection, type Region } from '../../lib/operations';
import { geofenceDistance, type GeofenceGeometry, type GeofencePoint } from '../../lib/geofencing';

export interface OperationsMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  addCenterPoint: () => void;
  focusGeofence: () => void;
}

interface OperationsMapProps {
  incidents: DisasterEvent[];
  layers: MapLayers;
  region: Region;
  basemap: 'satellite' | 'street';
  selection: MapSelection | null;
  onSelect: (selection: MapSelection) => void;
  geofence: GeofenceGeometry | null;
  drawing: boolean;
  onGeofencePoint: (point: GeofencePoint) => void;
  onGeofenceMove: (index: number, point: GeofencePoint) => void;
}

const incidentCodes = { typhoon: 'TY', flood: 'FL', earthquake: 'EQ', landslide: 'LS', fire: 'FR' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const mapHome = (map: L.Map, region: Region) => {
  if (region === 'all') map.fitBounds([[14.38, 120.45], [16.62, 121.38]], { padding: [80, 80] });
  else map.setView([14.64, 121.025], 11, { animate: false });
};

export const OperationsMap = forwardRef<OperationsMapHandle, OperationsMapProps>(function OperationsMap(
  { incidents, layers, region, basemap, selection, onSelect, geofence, drawing, onGeofencePoint, onGeofenceMove }, ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onGeofencePointRef = useRef(onGeofencePoint);
  const onGeofenceMoveRef = useRef(onGeofenceMove);
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading');
  onSelectRef.current = onSelect;
  onGeofencePointRef.current = onGeofencePoint;
  onGeofenceMoveRef.current = onGeofenceMove;

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    reset: () => { if (mapRef.current) mapHome(mapRef.current, region); },
    addCenterPoint: () => {
      const point = mapRef.current?.getCenter();
      if (point && drawing) onGeofencePointRef.current({ lat: point.lat, lng: point.lng });
    },
    focusGeofence: () => {
      const map = mapRef.current;
      if (!map || !geofence?.points.length) return;
      const coordinates = geofence.points.map((point) => L.latLng(point.lat, point.lng));
      const bounds = geofence.shape === 'circle' && coordinates.length === 2
        ? coordinates[0].toBounds(geofenceDistance(geofence.points[0], geofence.points[1]) * 2)
        : L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
    },
  }), [region, geofence, drawing]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false, attributionControl: false, minZoom: 5, maxZoom: 18,
      zoomSnap: 0.5, scrollWheelZoom: false,
    });
    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.stop(); map.remove(); mapRef.current = null; markerLayerRef.current = null; };
  }, []);

  useEffect(() => {
    if (mapRef.current) mapHome(mapRef.current, region);
  }, [region]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let errors = 0;
    let loaded = 0;
    setTileState('loading');
    const satellite = basemap === 'satellite';
    const tiles = L.tileLayer(satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: satellite
        ? 'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Maxar, Earthstar Geographics, GIS User Community'
        : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    tiles.on('tileload', () => { loaded++; setTileState('ready'); });
    tiles.on('tileerror', () => { if (++errors > 3 && !loaded) setTileState('error'); });
    tiles.addTo(map);
    // Leaflet registers its map-listener cleanup on the layer's remove event.
    // Keep those listeners until remove() has fired, especially during flyTo.
    return () => { tiles.remove(); tiles.off(); };
  }, [basemap]);

  useEffect(() => {
    const group = markerLayerRef.current;
    if (!group) return;
    group.clearLayers();
    const addMarker = (item: { id: string; lat: number; lng: number }, kind: MapSelection['kind'], title: string, code: string, color: string) => {
      const selected = selection?.id === item.id;
      const icon = L.divIcon({
        className: 'ops-map-icon', iconSize: [38, 38], iconAnchor: [19, 19],
        html: `<span class="ops-pin ops-pin--${kind}${selected ? ' is-selected' : ''}" style="--pin-color:${color}"><span>${escapeHtml(code)}</span></span>`,
      });
      const marker = L.marker([item.lat, item.lng], { icon, title, alt: title, interactive: !drawing, keyboard: !drawing, riseOnHover: true, zIndexOffset: selected ? 500 : 0 })
        .bindTooltip(escapeHtml(title), { direction: 'top', offset: [0, -16], className: 'ops-map-tooltip' })
        .on('click', () => { if (!drawing) onSelectRef.current({ kind, id: item.id }); }).addTo(group);
      marker.getElement()?.setAttribute('aria-label', title);
    };
    incidents.forEach((event) => {
      if (layers.risk) L.circle([event.lat, event.lng], {
        radius: event.type === 'typhoon' ? 7600 : 2100,
        color: severityColors[event.severity], weight: 1, opacity: 0.5,
        fillOpacity: event.type === 'typhoon' ? 0.035 : 0.09, dashArray: '3 7', interactive: false,
      }).addTo(group);
      if (layers.incidents) addMarker(event, 'incident', event.title, incidentCodes[event.type], severityColors[event.severity]);
    });
    if (layers.responders) responderTeams.forEach((team) => addMarker(team, 'responder', team.name, team.name.slice(0, 1), '#d0d0d0'));
    if (layers.infrastructure) infrastructureSites.forEach((site) => addMarker(site, 'infrastructure', site.name, '+', '#aac6d1'));
    if (basemap === 'satellite') [
      { name: 'MANILA BAY', lat: 14.58, lng: 120.8 },
      { name: 'QUEZON CITY', lat: 14.73, lng: 121.065 },
      { name: 'ANTIPOLO', lat: 14.61, lng: 121.22 },
      { name: 'CAVITE', lat: 14.43, lng: 120.91 },
    ].forEach((place) => L.marker([place.lat, place.lng], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'ops-map-label', html: place.name, iconSize: [120, 20], iconAnchor: [60, 10] }),
    }).addTo(group));
  }, [incidents, layers, selection, basemap, drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawing) return;
    const addPoint = (event: L.LeafletMouseEvent) => {
      onGeofencePointRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    };
    map.doubleClickZoom.disable();
    map.on('click', addPoint);
    return () => { map.off('click', addPoint); map.doubleClickZoom.enable(); };
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geofence) return;
    const group = L.layerGroup().addTo(map);
    const coordinates = geofence.points.map((point) => L.latLng(point.lat, point.lng));
    const style: L.PathOptions = { color: '#dceef2', fillColor: '#b8dce4', weight: 2, fillOpacity: .13, dashArray: drawing ? '6 5' : undefined, interactive: false, className: 'ops-geofence-boundary' };
    if (geofence.shape === 'circle' && coordinates.length === 2) {
      L.circle(coordinates[0], { ...style, radius: geofenceDistance(geofence.points[0], geofence.points[1]) }).addTo(group);
      if (drawing) L.polyline(coordinates, { ...style, weight: 1, dashArray: '3 6' }).addTo(group);
    } else if (geofence.shape === 'rectangle' && coordinates.length === 2) {
      L.rectangle(L.latLngBounds(coordinates), style).addTo(group);
    } else if (geofence.shape === 'polygon' && coordinates.length >= 3) {
      L.polygon(coordinates, style).addTo(group);
    } else if (coordinates.length > 1) {
      L.polyline(coordinates, style).addTo(group);
    }
    if (drawing) coordinates.forEach((point, index) => {
      const marker = L.marker(point, {
        draggable: true, zIndexOffset: 1500,
        icon: L.divIcon({ className: 'ops-fence-vertex', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
        title: `Geofence point ${index + 1}. Drag to move.`,
      }).addTo(group);
      marker.getElement()?.setAttribute('aria-label', `Geofence point ${index + 1}`);
      marker.on('dragend', () => {
        const moved = marker.getLatLng();
        onGeofenceMoveRef.current(index, { lat: moved.lat, lng: moved.lng });
      });
    });
    return () => { group.remove(); };
  }, [geofence, drawing]);

  useEffect(() => {
    const item = getSelection(selection);
    const map = mapRef.current;
    if (!item || !map) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 12), { animate: !reduceMotion, duration: 0.8 });
  }, [selection]);

  return <>
    <div className={`ops-map ops-map--${basemap}${drawing ? ' ops-map--drawing' : ''}`}>
      {/* Keep this className stable: Leaflet adds container/interaction classes here. */}
      <div ref={containerRef} className="ops-map-canvas" aria-label="Interactive emergency operations map. Use arrow keys to pan and plus or minus to zoom." />
    </div>
    <div className="ops-map-shade" />
    {tileState !== 'ready' && <div className="ops-map-notice" role="status">
      {tileState === 'loading' ? 'Loading map imagery…' : 'Map imagery is unavailable. Try the other map style or check your connection.'}
    </div>}
  </>;
});
