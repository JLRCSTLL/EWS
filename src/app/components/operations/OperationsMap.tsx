import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { infrastructureSites, responderTeams, type DisasterEvent } from '../../lib/dashboard-data';
import { getSelection, severityColors, type MapLayers, type MapSelection, type Region } from '../../lib/operations';
import { geofenceDistance, type AlertGeofence, type GeofenceGeometry, type GeofencePoint } from '../../lib/geofencing';
import { demoResidents, demoSnapshotAt, getExposure, type Resident } from '../../lib/residents';
import { fenceLayer, residentMarker } from './resident-map';
import { responderRoutes } from '../../lib/responder-routes';
import { useResponderRoutes } from './useResponderRoutes';

export interface OperationsMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  addCenterPoint: () => void;
  focusGeofence: () => void;
  focusRoute: (teamId: string) => void;
  captureView: () => { lat: number; lng: number; zoom: number } | null;
  restoreView: (view: { lat: number; lng: number; zoom: number }) => void;
  projectPoint: (point: GeofencePoint) => { x: number; y: number } | null;
  frameDemoArea: (geometry: GeofenceGeometry) => void;
  focusPoint: (point: GeofencePoint) => void;
  focusResidents: () => void;
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
  previewing?: boolean;
  onGeofencePoint: (point: GeofencePoint) => void;
  onGeofenceMove: (index: number, point: GeofencePoint) => void;
  areas: AlertGeofence[];
  selectedAreaId: string | null;
  onSelectGeofence: (id: string) => void;
  showResidents: boolean;
  simulationPaused: boolean;
  simulationReplay: number;
  onSimulationTick: (elapsed: number) => void;
  publicReports?: { id: string; point: GeofencePoint; label: string; kind: 'help' | 'safe' }[];
  residents?: Resident[];
  snapshotAt?: string;
  live?: boolean;
}

const incidentCodes = { typhoon: 'TY', flood: 'FL', earthquake: 'EQ', landslide: 'LS', fire: 'FR' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const mapHome = (map: L.Map, region: Region) => {
  if (region === 'all') map.fitBounds([[14.38, 120.45], [16.62, 121.38]], { padding: [80, 80] });
  else map.setView([14.60, 121.025], 11, { animate: false });
};

function frameLocations(map: L.Map, points: GeofencePoint[]) {
  if (!points.length) return;
  const desktop = map.getSize().x > 900;
  map.stop().fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])), {
    paddingTopLeft: desktop ? [340, 270] : [24, 360],
    paddingBottomRight: desktop ? [55, 300] : [24, 115],
    maxZoom: 15, animate: false,
  });
}

function focusRoute(map: L.Map, teamId: string) {
  const route = responderRoutes.find(item => item.teamId === teamId);
  if (!route) return;
  const desktop = map.getSize().x > 900;
  map.fitBounds(L.latLngBounds(route.points), {
    paddingTopLeft: desktop ? [325, 225] : [25, 240],
    paddingBottomRight: desktop ? [285, 285] : [25, 155],
    maxZoom: 15, animate: false,
  });
}

export const OperationsMap = forwardRef<OperationsMapHandle, OperationsMapProps>(function OperationsMap(
  { incidents, layers, region, basemap, selection, onSelect, geofence, drawing, previewing = false, onGeofencePoint, onGeofenceMove, areas, selectedAreaId, onSelectGeofence, showResidents, simulationPaused, simulationReplay, onSimulationTick, publicReports, residents = demoResidents, snapshotAt = demoSnapshotAt, live = false }, ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onGeofencePointRef = useRef(onGeofencePoint);
  const onGeofenceMoveRef = useRef(onGeofenceMove);
  const onSelectGeofenceRef = useRef(onSelectGeofence);
  const framedLiveLocations = useRef(false);
  const residentLayer = useRef<L.LayerGroup | null>(null);
  const residentMarkers = useRef(new Map<string,L.CircleMarker>());
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading');
  onSelectRef.current = onSelect;
  onGeofencePointRef.current = onGeofencePoint;
  onGeofenceMoveRef.current = onGeofenceMove;
  onSelectGeofenceRef.current = onSelectGeofence;

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    reset: () => {
      const map = mapRef.current;
      if (!map) return;
      const located = live && showResidents ? getExposure(residents, null, snapshotAt).located : [];
      if (located.length) frameLocations(map, located.map(user => user.location!));
      else mapHome(map, region);
    },
    focusRoute: (teamId) => { if (mapRef.current) focusRoute(mapRef.current, teamId); },
    captureView: () => { const map = mapRef.current; if (!map) return null; const center = map.getCenter(); return { lat: center.lat, lng: center.lng, zoom: map.getZoom() }; },
    restoreView: view => { mapRef.current?.stop().setView([view.lat, view.lng], view.zoom, { animate: false }); },
    focusPoint: point => {
      if (!mapRef.current) return;
      frameLocations(mapRef.current, [point]);
      framedLiveLocations.current = true;
    },
    focusResidents: () => {
      if (!mapRef.current) return;
      const located = getExposure(residents, null, snapshotAt).located;
      frameLocations(mapRef.current, located.map(user => user.location!));
      if (located.length) framedLiveLocations.current = true;
    },
    projectPoint: point => {
      const map = mapRef.current;
      if (!map || !containerRef.current) return null;
      const pixel = map.latLngToContainerPoint([point.lat, point.lng]);
      const bounds = containerRef.current.getBoundingClientRect();
      return { x: bounds.left + pixel.x, y: bounds.top + pixel.y };
    },
    frameDemoArea: geometry => {
      const map = mapRef.current;
      if (!map || !geometry.points.length) return;
      const desktop = map.getSize().x > 900;
      map.stop().fitBounds(L.latLngBounds(geometry.points.map(point => [point.lat, point.lng])), {
        paddingTopLeft: desktop ? [335, 240] : [35, 200],
        paddingBottomRight: desktop ? [320, 260] : [35, 180], maxZoom: geometry.shape === 'boundary' ? 16 : 13, animate: false,
      });
    },
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
  }), [region, geofence, drawing, residents, snapshotAt, live, showResidents]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false, attributionControl: false, minZoom: 5, maxZoom: 18,
      zoomSnap: 0.5, scrollWheelZoom: true, touchZoom: true,
    });
    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.stop(); map.remove(); mapRef.current = null; markerLayerRef.current = null; };
  }, []);

  useResponderRoutes({ mapRef, visible: layers.responders, drawing, paused: simulationPaused, replay: simulationReplay,
    selectedId: selection?.kind === 'responder' ? selection.id : null,
    onSelect: (id) => onSelectRef.current({ kind: 'responder', id }), onTick: onSimulationTick });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !publicReports?.length) return;
    const group = L.layerGroup().addTo(map);
    for (const report of publicReports) {
      const label = document.createElement('span'); label.textContent = report.label;
      L.circleMarker([report.point.lat, report.point.lng], { radius: report.kind === 'help' ? 12 : 8, color: '#fff', weight: 2, fillColor: report.kind === 'help' ? '#f49b62' : '#73cfab', fillOpacity: .95, interactive: !drawing }).addTo(group).bindTooltip(label, { direction: 'top', className: 'ops-map-tooltip' });
    }
    return () => { group.remove(); };
  }, [publicReports, drawing]);

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
    if (layers.responders) responderTeams.filter(team => !responderRoutes.some(route => route.teamId === team.id))
      .forEach((team) => addMarker(team, 'responder', team.name, team.name.slice(0, 1), '#d0d0d0'));
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
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    areas.forEach(area => {
      const selected = area.id === selectedAreaId;
      const boundary = fenceLayer(area, {
        color: selected ? '#dceef2' : '#adc1c4', weight: selected ? 2.5 : 1.5,
        fillColor: '#b8dce4', fillOpacity: selected && !drawing ? .12 : .025,
        dashArray: selected ? undefined : '5 6', interactive: !drawing,
      }).addTo(group);
      boundary.on('click', () => onSelectGeofenceRef.current(area.id));
      const label = document.createElement('span');
      label.textContent = area.name || 'Unnamed area';
      const marker = L.marker(boundary.getBounds().getNorthWest(), {
        title: `Select geofence: ${area.name || 'Unnamed area'}`, alt: `Select geofence: ${area.name || 'Unnamed area'}`,
        icon: L.divIcon({ className: `ops-area-label${selected ? ' is-selected' : ''}`, html: label, iconSize: [160, 26], iconAnchor: [0, 26] }),
        keyboard: !drawing, interactive: !drawing, zIndexOffset: 1100,
      }).addTo(group).on('click', () => onSelectGeofenceRef.current(area.id));
      marker.getElement()?.setAttribute('aria-label', `Select geofence: ${area.name || 'Unnamed area'}`);
    });
    return () => { group.remove(); };
  }, [areas, selectedAreaId, drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    residentLayer.current = group;
    return () => { group.remove(); residentLayer.current = null; residentMarkers.current.clear(); };
  }, []);

  useEffect(() => {
    const group = residentLayer.current;
    if (!group) return;
    if (!showResidents) { group.clearLayers(); residentMarkers.current.clear(); return; }
    const present = new Set<string>();
    getExposure(residents, live ? null : geofence, snapshotAt).located.forEach(user => {
      present.add(user.id);
      const next = residentMarker(user,snapshotAt,{interactive:!drawing,live});
      if (!next) return;
      const previous = residentMarkers.current.get(user.id);
      if (previous && previous.options.interactive === !drawing) {
        // Keep the same marker and open popup across updates; position is the latest reported GPS fix.
        previous.setLatLng(next.getLatLng()).setStyle(next.options).setRadius(next.getRadius());
        previous.setPopupContent(next.getPopup()!.getContent()!);
        if (next.getTooltip()) previous.setTooltipContent(next.getTooltip()!.getContent()!);
      } else {
        if (previous) group.removeLayer(previous);
        next.addTo(group); residentMarkers.current.set(user.id,next);
      }
    });
    for (const [id,marker] of residentMarkers.current) if (!present.has(id)) { group.removeLayer(marker); residentMarkers.current.delete(id); }
  }, [geofence, showResidents, drawing, residents, snapshotAt, live]);

  useEffect(() => {
    const located = getExposure(residents, null, snapshotAt).located;
    if (!live || !located.length) { framedLiveLocations.current = false; return; }
    // Frame the first received locations once; polling must not interrupt map navigation.
    if (mapRef.current && showResidents && !drawing && !framedLiveLocations.current) {
      frameLocations(mapRef.current, located.map(user => user.location!));
      framedLiveLocations.current = true;
    }
  }, [live, residents, snapshotAt, showResidents, drawing]);

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
    if (!map || !geofence || (!drawing && !previewing)) return;
    const group = L.layerGroup().addTo(map);
    const coordinates = geofence.points.map((point) => L.latLng(point.lat, point.lng));
    const style: L.PathOptions = { color: '#dceef2', fillColor: '#b8dce4', weight: 2, fillOpacity: .13, dashArray: drawing ? '6 5' : undefined, interactive: false, className: 'ops-geofence-boundary' };
    if (geofence.shape === 'boundary') {
      fenceLayer(geofence, { ...style, color:'#9ce8cc', fillColor:'#79cbae', fillOpacity:.14, weight:2.5 }).addTo(group);
    } else if (geofence.shape === 'circle' && coordinates.length === 2) {
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
  }, [geofence, drawing, previewing]);

  useEffect(() => {
    const item = getSelection(selection);
    const map = mapRef.current;
    if (!item || !map) return;
    if (selection?.kind === 'responder' && responderRoutes.some(route => route.teamId === selection.id)) {
      focusRoute(map, selection.id);
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 12), { animate: !reduceMotion, duration: 0.8 });
  }, [selection]);

  return <>
    <div className={`ops-map ops-map--${basemap}${drawing ? ' ops-map--drawing' : ''}`}>
      {/* Keep this className stable: Leaflet adds container/interaction classes here. */}
      <div ref={containerRef} className="ops-map-canvas" aria-label="Interactive emergency operations map. Scroll or pinch to zoom. Use arrow keys to pan and plus or minus to zoom." />
    </div>
    <div className="ops-map-shade" />
    {tileState !== 'ready' && <div className="ops-map-notice" role="status">
      {tileState === 'loading' ? 'Loading map imagery…' : 'Map imagery is unavailable. Try the other map style or check your connection.'}
    </div>}
  </>;
});
