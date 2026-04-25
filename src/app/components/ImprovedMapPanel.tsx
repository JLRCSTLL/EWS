import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Layers, Minus, Pen, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { disasterEvents, infrastructureSites, responderTeams, type Severity } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
type CategoryFilter = 'all' | MarkerCategory;

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
  const [disasterFilter, setDisasterFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
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

  const matchesCategoryFilter = (marker: MapMarker) =>
    categoryFilter === 'all' || marker.category === categoryFilter;

  const getSearchValues = (marker: MapMarker) => [
    marker.name,
    marker.subtitle,
    marker.type,
    marker.category,
    marker.severity ?? marker.meta ?? '',
  ];

  const matchesSearchFilter = (marker: MapMarker) =>
    query.length === 0 ||
    getSearchValues(marker).some((value) => value.toLowerCase().includes(query));

  const filteredDisasterMarkers = disasterMarkers.filter((marker) => {
    const matchesCategory = matchesCategoryFilter(marker);
    const matchesType = disasterFilter === 'all' || marker.type === disasterFilter;
    const matchesSeverity = severityFilter === 'all' || marker.severity === severityFilter;

    return matchesCategory && matchesType && matchesSeverity && matchesSearchFilter(marker);
  });

  const visibleMarkers = allMarkers.filter((marker) => {
    const layerEnabled = layers.find((layer) => layer.id === marker.layerId)?.enabled;
    if (!layerEnabled) {
      return false;
    }

    if (!matchesCategoryFilter(marker) || !matchesSearchFilter(marker)) {
      return false;
    }

    if (marker.category === 'disaster') {
      return filteredDisasterMarkers.some((candidate) => candidate.id === marker.id);
    }

    return true;
  });

  const selectedMarker = visibleMarkers.find((marker) => marker.id === selectedMarkerId) ?? null;
  const hasActiveFilters =
    query.length > 0 || categoryFilter !== 'all' || disasterFilter !== 'all' || severityFilter !== 'all';

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
      setZoom(map.getZoom());
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
    const mapContainer = mapContainerRef.current;
    if (!mapContainer || typeof ResizeObserver === 'undefined') {
      return;
    }

    let animationFrameId = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ animate: false });
      });
    });

    observer.observe(mapContainer);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
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
    setCategoryFilter('all');
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
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-slate-900">
      <div ref={mapContainerRef} className="tactical-map-canvas absolute inset-0" />

      <div className="absolute left-3 right-3 top-3 z-[500] flex items-start gap-2 sm:left-4 sm:right-auto sm:w-[min(560px,calc(100%-7rem))]">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded bg-white px-3 text-slate-900 shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                focusVisibleMarkers();
              }
            }}
            placeholder="Search maps"
            className="h-full border-0 bg-transparent px-0 text-sm text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:ring-0"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="group/map-filter relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-11 w-11 rounded bg-white text-slate-700 shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10 hover:bg-slate-50"
            title="Map filters"
            aria-label="Map filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600" />}
          </Button>

          <div className="pointer-events-none absolute right-0 top-12 w-[252px] max-w-[calc(100vw-1.5rem)] translate-y-1 rounded bg-white p-3 text-slate-800 opacity-0 shadow-xl shadow-slate-950/20 ring-1 ring-slate-950/10 transition-all duration-150 group-hover/map-filter:pointer-events-auto group-hover/map-filter:translate-y-0 group-hover/map-filter:opacity-100 group-focus-within/map-filter:pointer-events-auto group-focus-within/map-filter:translate-y-0 group-focus-within/map-filter:opacity-100">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase tracking-normal text-slate-500">Assets</Label>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                  className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Assets</option>
                  <option value="disaster">Incidents</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="responder">Responders</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-normal text-slate-500">Type</Label>
                  <select
                    value={disasterFilter}
                    onChange={(event) => setDisasterFilter(event.target.value)}
                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Types</option>
                    <option value="typhoon">Typhoon</option>
                    <option value="earthquake">Earthquake</option>
                    <option value="flood">Flood</option>
                    <option value="landslide">Landslide</option>
                    <option value="fire">Fire</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-normal text-slate-500">Severity</Label>
                  <select
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value)}
                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Levels</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                <span>{visibleMarkers.length} results</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  onClick={resetView}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="group/map-layers absolute bottom-4 left-4 z-[500]">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded bg-white text-slate-700 shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10 hover:bg-slate-50"
          title="Map layers"
          aria-label="Map layers"
        >
          <Layers className="h-4 w-4" />
        </Button>

        <div className="pointer-events-none absolute bottom-12 left-0 w-[210px] max-w-[calc(100vw-2rem)] translate-y-1 rounded bg-white p-3 text-xs text-slate-800 opacity-0 shadow-xl shadow-slate-950/20 ring-1 ring-slate-950/10 transition-all duration-150 group-hover/map-layers:pointer-events-auto group-hover/map-layers:translate-y-0 group-hover/map-layers:opacity-100 group-focus-within/map-layers:pointer-events-auto group-focus-within/map-layers:translate-y-0 group-focus-within/map-layers:opacity-100">
          <div className="space-y-2">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center gap-2">
                <Switch
                  checked={layer.enabled}
                  onCheckedChange={() => toggleLayer(layer.id)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label className="cursor-pointer text-xs text-slate-700" onClick={() => toggleLayer(layer.id)}>
                  {layer.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[500] flex flex-col items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded bg-white text-slate-700 shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10 hover:bg-slate-50"
          onClick={focusVisibleMarkers}
          title="Fit visible markers"
          aria-label="Fit visible markers"
        >
          <Crosshair className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10 ${
            drawingMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => setDrawingMode((current) => !current)}
          title="Draw geofence"
          aria-label="Draw geofence"
        >
          <Pen className="h-4 w-4" />
        </Button>

        <div className="overflow-hidden rounded bg-white shadow-lg shadow-slate-950/20 ring-1 ring-slate-950/10">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none text-slate-700 hover:bg-slate-50"
            onClick={() => setZoom((currentZoom) => Math.min(18, currentZoom + 1))}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <div className="h-px bg-slate-200" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none text-slate-700 hover:bg-slate-50"
            onClick={() => setZoom((currentZoom) => Math.max(4, currentZoom - 1))}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(drawingMode || selectedMarker) && (
        <div className="absolute bottom-[4.5rem] left-1/2 z-[500] max-w-[calc(100%-7.5rem)] -translate-x-1/2 rounded bg-slate-950/85 px-3 py-2 text-xs text-white shadow-lg shadow-slate-950/20 backdrop-blur-sm">
          {drawingMode ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span>Drawing geofence ({geofencePoints.length})</span>
              {geofencePoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 bg-white/10 px-2 text-xs text-white hover:bg-white/20"
                  onClick={() => setGeofencePoints([])}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          ) : (
            <span>{selectedMarker?.name}</span>
          )}
        </div>
      )}
    </div>
  );
}
