import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Crosshair, Layers, Minus, Pen, Plus, Search, X } from 'lucide-react';
import { disasterEvents, infrastructureSites, responderTeams, type Severity } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

interface MapLayer {
  id: 'risk-zones' | 'infrastructure' | 'responders';
  name: string;
  enabled: boolean;
}

interface GeofencePoint {
  id: string;
  lat: number;
  lng: number;
}

type MarkerCategory = 'disaster' | 'infrastructure' | 'responder';

interface MapMarker {
  id: string;
  category: MarkerCategory;
  type: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  color: string;
  code: string;
  severity?: Severity;
  meta?: string;
  layerId: MapLayer['id'];
}

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];
const DEFAULT_ZOOM = 11;

const severityColors: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const infrastructureColors = {
  operational: '#10b981',
  'at-capacity': '#f97316',
  offline: '#ef4444',
};

const responderColors = {
  deployed: '#22c55e',
  active: '#06b6d4',
  standby: '#94a3b8',
  returning: '#eab308',
};

const getDisasterCode = (type: string) => {
  switch (type) {
    case 'typhoon':
      return 'TY';
    case 'flood':
      return 'FL';
    case 'earthquake':
      return 'EQ';
    case 'landslide':
      return 'LS';
    case 'fire':
      return 'FR';
    default:
      return 'AL';
  }
};

const getInfrastructureCode = (type: string) => {
  switch (type) {
    case 'hospital':
      return 'MD';
    case 'shelter':
      return 'SH';
    case 'fire-station':
      return 'FS';
    default:
      return 'IN';
  }
};

const getResponderCode = (status: string) => {
  switch (status) {
    case 'deployed':
      return 'DP';
    case 'active':
      return 'AC';
    case 'standby':
      return 'SB';
    case 'returning':
      return 'RT';
    default:
      return 'RS';
  }
};

const getAlertRadius = (severity: Severity) => {
  switch (severity) {
    case 'critical':
      return 16_000;
    case 'high':
      return 10_000;
    case 'medium':
      return 6_000;
    case 'low':
      return 3_500;
    default:
      return 3_500;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const createMarkerIcon = (marker: MapMarker, isSelected: boolean) =>
  L.divIcon({
    className: 'tactical-map-div-icon',
    html: `<div class="tactical-map-marker${isSelected ? ' is-selected' : ''}" style="--marker-color: ${marker.color};">${escapeHtml(marker.code)}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });

const createPopupHtml = (marker: MapMarker) => `
  <div class="tactical-map-popup-card">
    <div class="tactical-map-popup-title">${escapeHtml(marker.name)}</div>
    <div class="tactical-map-popup-subtitle">${escapeHtml(marker.subtitle)}</div>
    <div class="tactical-map-popup-line">${escapeHtml(marker.type.replace('-', ' '))}</div>
    ${marker.severity ? `<div class="tactical-map-popup-line">Severity: ${escapeHtml(marker.severity)}</div>` : ''}
    ${marker.meta ? `<div class="tactical-map-popup-meta">${escapeHtml(marker.meta)}</div>` : ''}
  </div>
`;

export function ImprovedMapPanel() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const didFitInitialBoundsRef = useRef(false);

  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'risk-zones', name: 'Risk Zones', enabled: true },
    { id: 'infrastructure', name: 'Infrastructure', enabled: true },
    { id: 'responders', name: 'Responders', enabled: true },
  ]);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [disasterFilter, setDisasterFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [geofencePoints, setGeofencePoints] = useState<GeofencePoint[]>([]);

  const disasterMarkers: MapMarker[] = disasterEvents.map((event) => ({
    id: event.id,
    category: 'disaster',
    type: event.type,
    name: event.title,
    subtitle: event.location,
    lat: event.lat,
    lng: event.lng,
    color: severityColors[event.severity],
    code: getDisasterCode(event.type),
    severity: event.severity,
    meta: `${event.source} | ${formatRelativeTime(event.createdAt)}`,
    layerId: 'risk-zones',
  }));

  const infrastructureMarkers: MapMarker[] = infrastructureSites.map((site) => ({
    id: site.id,
    category: 'infrastructure',
    type: site.type,
    name: site.name,
    subtitle: site.location,
    lat: site.lat,
    lng: site.lng,
    color: infrastructureColors[site.status],
    code: getInfrastructureCode(site.type),
    meta: site.status.replace('-', ' '),
    layerId: 'infrastructure',
  }));

  const responderMarkers: MapMarker[] = responderTeams.map((team) => ({
    id: team.id,
    category: 'responder',
    type: team.type,
    name: team.name,
    subtitle: team.location,
    lat: team.lat,
    lng: team.lng,
    color: responderColors[team.status],
    code: getResponderCode(team.status),
    meta: `${team.personnel} personnel | ${team.status}`,
    layerId: 'responders',
  }));

  const allMarkers = [...disasterMarkers, ...infrastructureMarkers, ...responderMarkers];
  const query = searchQuery.trim().toLowerCase();

  const filteredDisasterMarkers = disasterMarkers.filter((marker) => {
    const matchesType = disasterFilter === 'all' || marker.type === disasterFilter;
    const matchesSeverity = severityFilter === 'all' || marker.severity === severityFilter;
    const matchesSearch =
      query.length === 0 ||
      marker.name.toLowerCase().includes(query) ||
      marker.subtitle.toLowerCase().includes(query);

    return matchesType && matchesSeverity && matchesSearch;
  });

  const visibleMarkers = allMarkers.filter((marker) => {
    const layerEnabled = layers.find((layer) => layer.id === marker.layerId)?.enabled;
    if (!layerEnabled) {
      return false;
    }

    const matchesSearch =
      query.length === 0 ||
      marker.name.toLowerCase().includes(query) ||
      marker.subtitle.toLowerCase().includes(query) ||
      marker.type.toLowerCase().includes(query);

    if (!matchesSearch) {
      return false;
    }

    if (marker.category === 'disaster') {
      return filteredDisasterMarkers.some((candidate) => candidate.id === marker.id);
    }

    return true;
  });

  const selectedMarker = visibleMarkers.find((marker) => marker.id === selectedMarkerId) ?? null;

  const fitMarkers = (markersToFit: MapMarker[]) => {
    const map = mapRef.current;
    if (!map || markersToFit.length === 0) {
      return;
    }

    if (markersToFit.length === 1) {
      map.setView([markersToFit[0].lat, markersToFit[0].lng], Math.max(map.getZoom(), 13), { animate: true });
      return;
    }

    const bounds = L.latLngBounds(markersToFit.map((marker) => [marker.lat, marker.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.2), { animate: true });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    overlaysRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const syncViewState = () => {
      const center = map.getCenter();
      setZoom(map.getZoom());
      setMapCenter([Number(center.lat.toFixed(4)), Number(center.lng.toFixed(4))]);
    };

    map.on('zoomend', syncViewState);
    map.on('moveend', syncViewState);
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    syncViewState();

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      overlaysRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || didFitInitialBoundsRef.current || allMarkers.length === 0) {
      return;
    }

    fitMarkers(allMarkers);
    didFitInitialBoundsRef.current = true;
  }, [allMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (map.getZoom() !== zoom) {
      map.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    if (selectedMarkerId && !visibleMarkers.some((marker) => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [selectedMarkerId, visibleMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      if (!drawingMode) {
        setSelectedMarkerId(null);
        return;
      }

      setGeofencePoints((currentPoints) => [
        ...currentPoints,
        {
          id: `point-${Date.now()}-${currentPoints.length}`,
          lat: Number(event.latlng.lat.toFixed(5)),
          lng: Number(event.latlng.lng.toFixed(5)),
        },
      ]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawingMode]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    if (!map || !overlays) {
      return;
    }

    overlays.clearLayers();
    const markerLookup = new Map<string, L.Marker>();

    if (layers.find((layer) => layer.id === 'risk-zones')?.enabled) {
      filteredDisasterMarkers.forEach((marker) => {
        L.circle([marker.lat, marker.lng], {
          radius: getAlertRadius(marker.severity ?? 'low'),
          color: marker.color,
          weight: 1.5,
          opacity: 0.6,
          fillColor: marker.color,
          fillOpacity: 0.12,
        }).addTo(overlays);
      });
    }

    visibleMarkers.forEach((marker) => {
      const leafletMarker = L.marker([marker.lat, marker.lng], {
        icon: createMarkerIcon(marker, marker.id === selectedMarkerId),
        keyboard: false,
      }).addTo(overlays);

      leafletMarker.bindPopup(createPopupHtml(marker), {
        className: 'tactical-map-popup',
        closeButton: false,
        offset: [0, -14],
      });

      leafletMarker.on('click', () => {
        setSelectedMarkerId(marker.id);
      });

      markerLookup.set(marker.id, leafletMarker);
    });

    if (geofencePoints.length > 0) {
      const latLngs = geofencePoints.map((point) => [point.lat, point.lng] as [number, number]);

      if (latLngs.length > 2) {
        L.polygon(latLngs, {
          color: '#22d3ee',
          weight: 2,
          dashArray: '6 4',
          fillColor: '#22d3ee',
          fillOpacity: 0.12,
        }).addTo(overlays);
      } else if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: '#22d3ee',
          weight: 2,
          dashArray: '6 4',
        }).addTo(overlays);
      }

      geofencePoints.forEach((point) => {
        L.circleMarker([point.lat, point.lng], {
          radius: 5,
          color: '#ecfeff',
          weight: 1.5,
          fillColor: '#22d3ee',
          fillOpacity: 1,
        }).addTo(overlays);
      });
    }

    if (selectedMarkerId) {
      const selectedLeafletMarker = markerLookup.get(selectedMarkerId);
      if (selectedLeafletMarker) {
        selectedLeafletMarker.openPopup();
        selectedLeafletMarker.setZIndexOffset(1_000);
        map.panTo(selectedLeafletMarker.getLatLng(), { animate: true });
      }
    }
  }, [filteredDisasterMarkers, geofencePoints, layers, selectedMarkerId, visibleMarkers]);

  const toggleLayer = (layerId: MapLayer['id']) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer,
      ),
    );
  };

  const resetView = () => {
    setSearchQuery('');
    setDisasterFilter('all');
    setSeverityFilter('all');
    setSelectedMarkerId(null);
    fitMarkers(allMarkers);
  };

  const focusVisibleMarkers = () => {
    if (visibleMarkers.length > 0) {
      fitMarkers(visibleMarkers);
    } else {
      resetView();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-cyan-900/30 bg-slate-900/80 p-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  focusVisibleMarkers();
                }
              }}
              placeholder="Search location, unit, or incident..."
              className="h-8 border-cyan-900/30 bg-slate-800 text-xs text-slate-300"
            />
          </div>

          <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-700"
              onClick={() => setZoom((currentZoom) => Math.min(18, currentZoom + 1))}
            >
              <Plus className="h-4 w-4 text-slate-300" />
            </Button>
            <div className="border-x border-slate-700 px-2 font-mono text-xs text-slate-400">{zoom}</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-700"
              onClick={() => setZoom((currentZoom) => Math.max(4, currentZoom - 1))}
            >
              <Minus className="h-4 w-4 text-slate-300" />
            </Button>
          </div>

          <Button
            variant={drawingMode ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setDrawingMode((current) => !current)}
          >
            <Pen className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={focusVisibleMarkers}>
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={disasterFilter} onValueChange={setDisasterFilter}>
            <SelectTrigger className="h-8 border-cyan-900/30 bg-slate-800 text-xs text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-cyan-900/30 bg-slate-800">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="typhoon">Typhoon</SelectItem>
              <SelectItem value="earthquake">Earthquake</SelectItem>
              <SelectItem value="flood">Flood</SelectItem>
              <SelectItem value="landslide">Landslide</SelectItem>
              <SelectItem value="fire">Fire</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 border-cyan-900/30 bg-slate-800 text-xs text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-cyan-900/30 bg-slate-800">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-1 text-[10px] font-mono text-cyan-400">
            <AlertTriangle className="h-3 w-3" />
            {filteredDisasterMarkers.length} visible alerts | {visibleMarkers.length} visible assets
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-slate-900">
        <div ref={mapContainerRef} className="tactical-map-canvas absolute inset-0" />

        <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-cyan-400/70 backdrop-blur-sm">
          {mapCenter[0].toFixed(4)} N, {mapCenter[1].toFixed(4)} E
        </div>

        <div className="absolute right-2 top-2 max-h-[320px] overflow-y-auto rounded border border-cyan-900/30 bg-slate-900/95 p-2 text-xs backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2 font-mono text-cyan-400">
            <Layers className="h-4 w-4" />
            <span>MAP LAYERS</span>
          </div>

          <div className="space-y-2">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center gap-2">
                <Switch
                  checked={layer.enabled}
                  onCheckedChange={() => toggleLayer(layer.id)}
                  className="data-[state=checked]:bg-cyan-500"
                />
                <Label className="cursor-pointer text-xs text-slate-300" onClick={() => toggleLayer(layer.id)}>
                  {layer.name}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-2 font-mono text-cyan-400">DATA SOURCE</div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-2 text-[10px] text-slate-400">
              OpenStreetMap tiles with live Leaflet map rendering.
            </div>
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-2 font-mono text-cyan-400">LEGEND</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-slate-300">Critical Incident</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-500" />
                <span className="text-slate-300">High Impact</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-slate-300">Operational Asset</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-cyan-500" />
                <span className="text-slate-300">Active Responder</span>
              </div>
            </div>
          </div>
        </div>

        {(drawingMode || selectedMarker) && (
          <div className="absolute left-1/2 top-2 z-[500] -translate-x-1/2 rounded border border-cyan-500/50 bg-cyan-900/90 px-4 py-2 font-mono text-xs text-cyan-100 backdrop-blur-sm">
            {drawingMode ? (
              <div className="flex items-center gap-3">
                <span>DRAWING MODE ACTIVE | Click map to place geofence points ({geofencePoints.length})</span>
                {geofencePoints.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-cyan-300/40 bg-transparent px-2 text-cyan-100 hover:bg-cyan-800"
                    onClick={() => setGeofencePoints([])}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                )}
              </div>
            ) : (
              <span>{selectedMarker?.name} selected for tactical focus</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
