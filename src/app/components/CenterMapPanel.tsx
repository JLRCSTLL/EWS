import { useState } from 'react';
import { AlertTriangle, Hospital, Home, Flame, Users, MapPin, Shield } from 'lucide-react';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface MapLayer {
  id: string;
  name: string;
  enabled: boolean;
  icon: any;
}

interface DisasterEvent {
  id: string;
  type: 'typhoon' | 'earthquake' | 'flood';
  severity: 'critical' | 'high' | 'medium';
  lat: number;
  lng: number;
  name: string;
  radius: number;
  x: number;
  y: number;
}

interface Infrastructure {
  id: string;
  type: 'hospital' | 'shelter' | 'fire-station';
  lat: number;
  lng: number;
  name: string;
  status: 'operational' | 'at-capacity' | 'offline';
  x: number;
  y: number;
}

interface Responder {
  id: string;
  lat: number;
  lng: number;
  team: string;
  personnel: number;
  status: 'active' | 'standby' | 'deployed';
  x: number;
  y: number;
}

export function CenterMapPanel() {
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'risk-zones', name: 'Risk Zones', enabled: true, icon: AlertTriangle },
    { id: 'infrastructure', name: 'Critical Infrastructure', enabled: true, icon: Hospital },
    { id: 'shelters', name: 'Evacuation Centers', enabled: true, icon: Home },
    { id: 'responders', name: 'Emergency Responders', enabled: true, icon: Users },
    { id: 'drrm-officials', name: 'DRRM Officials', enabled: false, icon: Shield },
  ]);

  const [disasterFilter, setDisasterFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);

  // Mock disaster events with screen positions
  const disasterEvents: DisasterEvent[] = [
    { id: '1', type: 'typhoon', severity: 'critical', lat: 14.5995, lng: 120.9842, name: 'Typhoon Ramon', radius: 50000, x: 45, y: 35 },
    { id: '2', type: 'flood', severity: 'high', lat: 14.6507, lng: 121.0494, name: 'Metro Flood Zone', radius: 15000, x: 60, y: 25 },
    { id: '3', type: 'earthquake', severity: 'medium', lat: 14.5547, lng: 121.0244, name: 'Seismic Activity', radius: 20000, x: 55, y: 50 },
  ];

  const infrastructure: Infrastructure[] = [
    { id: '1', type: 'hospital', lat: 14.5793, lng: 120.9757, name: 'Manila General Hospital', status: 'operational', x: 40, y: 45 },
    { id: '2', type: 'hospital', lat: 14.6091, lng: 121.0223, name: 'Medical Center East', status: 'at-capacity', x: 55, y: 30 },
    { id: '3', type: 'shelter', lat: 14.5833, lng: 121.0631, name: 'Central Evacuation Center', status: 'operational', x: 65, y: 40 },
    { id: '4', type: 'shelter', lat: 14.6198, lng: 120.9886, name: 'North Shelter Complex', status: 'operational', x: 48, y: 20 },
    { id: '5', type: 'fire-station', lat: 14.5991, lng: 120.9845, name: 'Station 12', status: 'operational', x: 45, y: 35 },
  ];

  const responders: Responder[] = [
    { id: '1', lat: 14.5895, lng: 120.9845, team: 'Alpha Team', personnel: 12, status: 'deployed', x: 43, y: 42 },
    { id: '2', lat: 14.6107, lng: 121.0194, team: 'Bravo Team', personnel: 8, status: 'active', x: 53, y: 28 },
    { id: '3', lat: 14.5647, lng: 121.0344, team: 'Charlie Team', personnel: 15, status: 'deployed', x: 58, y: 55 },
  ];

  const toggleLayer = (id: string) => {
    setLayers(layers.map(layer =>
      layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
    ));
  };

  const getDisasterColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#3b82f6';
    }
  };

  const getInfrastructureIcon = (type: string) => {
    switch (type) {
      case 'hospital': return '🏥';
      case 'shelter': return '🏠';
      case 'fire-station': return '🚒';
      default: return '📍';
    }
  };

  const filteredDisasterEvents = disasterEvents
    .filter(e => disasterFilter === 'all' || e.type === disasterFilter)
    .filter(e => severityFilter === 'all' || e.severity === severityFilter);

  return (
    <div className="h-full flex flex-col bg-slate-950 border border-cyan-900/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border-b border-cyan-900/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h2 className="text-cyan-400 font-mono tracking-wider">TACTICAL MAP DISPLAY</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-cyan-400/70 font-mono">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            LIVE TRACKING
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-slate-900/80 border-b border-cyan-900/30 p-3 grid grid-cols-3 gap-4">
        {/* Layer Toggles */}
        <div className="space-y-2">
          <div className="text-xs text-cyan-400/70 font-mono mb-2">MAP LAYERS</div>
          <div className="grid grid-cols-2 gap-2">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center gap-2">
                <Switch
                  checked={layer.enabled}
                  onCheckedChange={() => toggleLayer(layer.id)}
                  className="data-[state=checked]:bg-cyan-500"
                />
                <Label className="text-xs text-slate-300 cursor-pointer" onClick={() => toggleLayer(layer.id)}>
                  {layer.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Disaster Type Filter */}
        <div className="space-y-2">
          <div className="text-xs text-cyan-400/70 font-mono mb-2">DISASTER TYPE</div>
          <Select value={disasterFilter} onValueChange={setDisasterFilter}>
            <SelectTrigger className="bg-slate-800 border-cyan-900/30 text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-cyan-900/30">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="typhoon">Typhoon</SelectItem>
              <SelectItem value="earthquake">Earthquake</SelectItem>
              <SelectItem value="flood">Flood</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Severity Filter */}
        <div className="space-y-2">
          <div className="text-xs text-cyan-400/70 font-mono mb-2">SEVERITY LEVEL</div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="bg-slate-800 border-cyan-900/30 text-slate-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-cyan-900/30">
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Map Display */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        {/* Background Map Grid */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#164e63" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Map Region Outline (Philippines-inspired) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="80%" height="80%" viewBox="0 0 200 300" className="opacity-30">
            <path
              d="M 100 50 L 120 80 L 140 110 L 145 140 L 140 170 L 130 200 L 120 230 L 100 260 L 80 240 L 70 210 L 65 180 L 60 150 L 65 120 L 75 90 L 90 60 Z"
              fill="none"
              stroke="#0891b2"
              strokeWidth="2"
              className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
            />
          </svg>
        </div>

        {/* Disaster Risk Zones */}
        {layers.find(l => l.id === 'risk-zones')?.enabled && filteredDisasterEvents.map((event) => (
          <div
            key={event.id}
            className="absolute rounded-full pointer-events-none animate-pulse"
            style={{
              left: `${event.x}%`,
              top: `${event.y}%`,
              width: '120px',
              height: '120px',
              transform: 'translate(-50%, -50%)',
              backgroundColor: getDisasterColor(event.severity),
              opacity: 0.2,
              boxShadow: `0 0 40px ${getDisasterColor(event.severity)}`,
            }}
          />
        ))}

        {/* Disaster Event Markers */}
        {layers.find(l => l.id === 'risk-zones')?.enabled && filteredDisasterEvents.map((event) => (
          <div
            key={`marker-${event.id}`}
            className="absolute cursor-pointer z-10"
            style={{
              left: `${event.x}%`,
              top: `${event.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={() => setHoveredMarker(`disaster-${event.id}`)}
            onMouseLeave={() => setHoveredMarker(null)}
          >
            <div className="relative">
              <AlertTriangle 
                className="w-6 h-6 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ color: getDisasterColor(event.severity) }}
              />
              {hoveredMarker === `disaster-${event.id}` && (
                <div className="absolute left-8 top-0 bg-slate-900 border border-cyan-900/50 rounded p-2 text-xs whitespace-nowrap z-50">
                  <div className="font-bold text-slate-200">{event.name}</div>
                  <div className="text-slate-400">Type: {event.type}</div>
                  <div className="text-slate-400">Severity: {event.severity}</div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Infrastructure Markers */}
        {layers.find(l => l.id === 'infrastructure')?.enabled && infrastructure.map((infra) => (
          <div
            key={`infra-${infra.id}`}
            className="absolute cursor-pointer z-10"
            style={{
              left: `${infra.x}%`,
              top: `${infra.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={() => setHoveredMarker(`infra-${infra.id}`)}
            onMouseLeave={() => setHoveredMarker(null)}
          >
            <div className="relative">
              <div className="text-2xl drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]">
                {getInfrastructureIcon(infra.type)}
              </div>
              {hoveredMarker === `infra-${infra.id}` && (
                <div className="absolute left-8 top-0 bg-slate-900 border border-cyan-900/50 rounded p-2 text-xs whitespace-nowrap z-50">
                  <div className="font-bold text-slate-200">{infra.name}</div>
                  <div className="text-slate-400">Type: {infra.type}</div>
                  <div className="text-slate-400">Status: {infra.status}</div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Responder Markers */}
        {layers.find(l => l.id === 'responders')?.enabled && responders.map((responder) => (
          <div
            key={`responder-${responder.id}`}
            className="absolute cursor-pointer z-10"
            style={{
              left: `${responder.x}%`,
              top: `${responder.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={() => setHoveredMarker(`responder-${responder.id}`)}
            onMouseLeave={() => setHoveredMarker(null)}
          >
            <div className="relative">
              <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">
                <Users className="w-4 h-4 text-white" />
              </div>
              {hoveredMarker === `responder-${responder.id}` && (
                <div className="absolute left-10 top-0 bg-slate-900 border border-cyan-900/50 rounded p-2 text-xs whitespace-nowrap z-50">
                  <div className="font-bold text-slate-200">{responder.team}</div>
                  <div className="text-slate-400">Personnel: {responder.personnel}</div>
                  <div className="text-slate-400">Status: {responder.status}</div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Grid Coordinates */}
        <div className="absolute top-2 left-2 text-xs text-cyan-400/50 font-mono">
          14.5995°N, 120.9842°E
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-cyan-400/50 font-mono">
          ZOOM: 12 | SCALE: 1:50000
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-slate-900/95 border border-cyan-900/30 rounded p-3 text-xs">
          <div className="text-cyan-400 font-mono mb-2">LEGEND</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-300">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-slate-300">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-slate-300">Medium</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
