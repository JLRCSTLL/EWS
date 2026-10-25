import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowUpRight, Bell, ChevronDown, ChevronRight,
  CircleHelp, Crosshair, Expand, Flame, Layers, LayoutGrid, MapPin, Minus,
  Ambulance, Mountain, Pause, PenLine, Play, Plus, Radio, RotateCcw, Search, Send, ShieldCheck,
  Smartphone, Users, Video, Waves, Wind, X,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  disasterEvents, infrastructureSites, responderTeams,
  type DisasterEvent, type ResponderTeam,
} from '../../lib/dashboard-data';
import { formatRelativeTime } from '../../lib/formatting';
import {
  getIncidents, getSelection, severityColors, type IncidentFilter, type MapLayers,
  type MapSelection, type Region,
} from '../../lib/operations';
import type { WidgetRuntimeProps } from '../../lib/widget-registry';
import { AuditLogs } from '../AuditLogs';
import { MessageHistory } from '../MessageHistory';
import { RiskMonitoring } from '../RiskMonitoring';
import { SystemHealth } from '../SystemHealth';
import { UserManagement } from '../UserManagement';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { OperationsMap, type OperationsMapHandle } from './OperationsMap';
import { GeofenceTools } from './GeofenceTools';
import { PopulationPanel } from './PopulationPanel';
import { AudienceBroadcastPanel } from './AudienceBroadcastPanel';
import { CommandSidebar } from './CommandSidebar';
import { ResponderRouteCard } from './ResponderRouteCard';
import { CctvMonitoring } from './CctvMonitoring';
import { PresentationTour } from './PresentationTour';
import { PublicActivityPanel } from './PublicActivityPanel';
import { ConnectedOperations, ConnectedSidebar } from './ConnectedOperations';
import { GroupsWorkspace } from './GroupsWorkspace';
import { PlaceSearch } from './PlaceSearch';
import { CommandNotifications } from './CommandNotifications';
import type { BoundaryPlace } from '../../lib/place-search';
import { useLive } from '../../lib/live-service';
import { asResident, openRequest } from '../../lib/live-model';
import { usePublicDemo } from '../../lib/public-demo-store';
import { isOpenRequest, publicProfiles } from '../../lib/public-demo';
import '../../../styles/public-bridge.css';
import { presentationArea, presentationSteps, tourStepIndex } from '../../lib/presentation-tour';
import { RESPONDER_DEMO_DURATION, responderRoutes } from '../../lib/responder-routes';
import { demoGeofences, type AudienceGroup } from '../../lib/residents';
import { getGeofenceError, isAlertGeofence, type AlertGeofence, type GeofenceGeometry, type GeofencePoint, type GeofenceShape } from '../../lib/geofencing';

const GEOFENCE_STORAGE_KEY = 'ecc-map-geofences-v2';
function readGeofences(): AlertGeofence[] {
  try {
    const areas = JSON.parse(localStorage.getItem(GEOFENCE_STORAGE_KEY) || 'null');
    if (Array.isArray(areas)) return areas.filter(isAlertGeofence).filter((area, index, all) => all.findIndex(item => item.id === area.id) === index);
    const legacy = JSON.parse(localStorage.getItem('ecc-map-alert-geofence') || 'null');
    return isAlertGeofence(legacy) ? [legacy, ...demoGeofences] : demoGeofences;
  } catch { return demoGeofences; }
}
function readSelectedGeofence(): string | null {
  const areas = readGeofences();
  try {
    const stored = localStorage.getItem('ecc-map-selected-geofence');
    if (stored !== null) {
      const id = JSON.parse(stored);
      if (id === null || areas.some(area => area.id === id)) return id;
    }
  } catch { /* Fall back to the first saved area. */ }
  return areas[0]?.id || null;
}

type Section = 'incidents' | 'responders' | 'analytics' | 'activity' | 'broadcast' | 'users' | 'help' | 'public' | 'connected' | 'groups' | null;
interface Props extends WidgetRuntimeProps {
  onOpenWorkspace: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const incidentIcons = { typhoon: Wind, flood: Waves, earthquake: Activity, landslide: Mountain, fire: Flame };
const navigation = [
  ['incidents', 'Incidents'], ['responders', 'Responders'], ['public', 'Field inbox'], ['analytics', 'Analytics'], ['activity', 'Activity'],
] as const;
const layerLabels: Record<keyof MapLayers, string> = {
  incidents: 'Incident markers', responders: 'Response teams', infrastructure: 'Critical facilities', risk: 'Risk zones',
};
const sectionTitles: Record<Exclude<Section, null>, string> = {
  incidents: 'Incident center', responders: 'Response teams', analytics: 'Operational analytics',
  activity: 'Activity log', broadcast: 'Broadcast center', users: 'Team & access', help: 'Your command center',
  public: 'Public assistance & check-ins',
  connected: 'Personnel & access', groups: 'Groups',
};
const sectionDescriptions: Record<Exclude<Section, null>, string> = {
  incidents: 'Review reported events and locate them on the map.',
  responders: 'Personnel, deployment status, and the latest field locations.',
  analytics: 'Risk exposure and system performance from the sample dataset.',
  activity: 'Recent configuration, access, and broadcast activity on this workstation.',
  broadcast: 'Demo broadcasts reach matching public profiles in this browser. No real notifications are sent.',
  users: 'Review the existing operator directory and access roles.',
  help: 'A clearer view of your emergency operations.',
  public: 'Two-way presentation updates from the TANOVIQ public app.',
  connected: 'Preferred names, on-duty locations, and consent-based contact access.',
  groups: 'Manage members, assign leaders, and send alerts to the teams you create.',
};

function IncidentIcon({ event }: { event: DisasterEvent }) {
  const Icon = incidentIcons[event.type];
  return <span className={`ops-incident-icon severity-${event.severity}`}><Icon size={17} strokeWidth={1.5} /></span>;
}

function TeamCard({ team, onSelect }: { team: ResponderTeam; onSelect: () => void }) {
  const active = team.status === 'deployed' || team.status === 'active';
  const route = responderRoutes.find(item => item.teamId === team.id);
  return <button className="ops-team-card" onClick={onSelect} aria-label={`Locate ${team.name}`}>
    <div className="ops-card-heading"><span>{team.name}</span><ArrowUpRight size={13} /></div>
    <span className="ops-team-type">{team.type}</span>
    <div className="ops-team-visual">
      <div className="ops-team-orbit" aria-hidden="true"><Crosshair size={25} strokeWidth={0.9} /><span>{team.name[0]}</span></div>
      <div className="ops-team-personnel"><strong>{team.personnel}</strong><span>personnel</span></div>
    </div>
    <div className="ops-team-meta"><span className={active ? 'ops-status' : 'ops-status is-muted'}><i />{team.status}</span><Radio size={12} /></div>
    <div className="ops-team-location" title={route?.destination || team.location}><MapPin size={10} /><span>{route ? `To ${route.destination}` : team.location}</span></div>
    <div className="ops-team-updated">{route ? `${route.label} · demo route` : `Updated ${formatRelativeTime(team.lastUpdateAt)}`}</div>
  </button>;
}

function OperationsClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <time className="ops-clock" dateTime={now.toISOString()}>
    {new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Manila' }).format(now)}
    <span>PHT</span>
  </time>;
}

export function OperationsDashboard({ auditLogs, messages, onSendMessage, onOpenWorkspace, onFullscreen, isFullscreen }: Props) {
  const live = useLive();
  const [liveMode, setLiveMode] = useState(() => new URLSearchParams(location.search).get('demo') !== '1');
  const publicState = usePublicDemo();
  const publicPending = publicState.requests.filter(isOpenRequest).length;
  const publicReports = useMemo(() => [
    ...publicState.requests.filter(request => isOpenRequest(request) && request.location).map(request => ({ id: request.id, point: request.location!, label: `${publicProfiles.find(profile => profile.resident.id === request.residentId)?.name || 'Resident'} · ${request.type} · demo`, kind: 'help' as const })),
    ...publicState.checkIns.filter(item => item.location).map(item => ({ id: `safe-${item.residentId}`, point: item.location!, label: `${publicProfiles.find(profile => profile.resident.id === item.residentId)?.name || 'Resident'} · reported safe · demo`, kind: 'safe' as const })),
  ], [publicState]);
  const [section, setSection] = useState<Section>(null);
  const [activeView, setActiveView] = useState<'map' | 'cctv'>(() => window.location.hash === '#/cctv' ? 'cctv' : 'map');
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const liveView = liveMode && tourIndex === null;
  const approved = live.state && ['operator','admin'].includes(live.state.user.role);
  const realUsers = useMemo(() => approved ? live.state!.users.map(asResident) : [], [approved,live.state?.users]);
  const [tourRun, setTourRun] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(true);
  const [presentationAreas, setPresentationAreas] = useState<AlertGeofence[]>(demoGeofences);
  const [region, setRegion] = useState<Region>('metro-manila');
  const [filter, setFilter] = useState<IncidentFilter>('all');
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [layers, setLayers] = useState<MapLayers>({ incidents: true, responders: true, infrastructure: false, risk: true });
  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [alertsVisible, setAlertsVisible] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>('event-1');
  const [incidentQuery, setIncidentQuery] = useState('');
  const [broadcastTab, setBroadcastTab] = useState<'compose' | 'history'>('compose');
  const [geofences, setGeofences] = useState<AlertGeofence[]>(readGeofences);
  const [selectedFenceId, setSelectedFenceId] = useState<string | null>(readSelectedGeofence);
  const visibleGeofences = tourIndex === null ? geofences : presentationAreas;
  const updateAreas = tourIndex === null ? setGeofences : setPresentationAreas;
  const alertGeofence = visibleGeofences.find(area => area.id === selectedFenceId) || null;
  const [teamGroupId,setTeamGroupId] = useState<string | undefined>();
  const [broadcastGroup, setBroadcastGroup] = useState<AudienceGroup>('all');
  const [broadcastActiveOnly, setBroadcastActiveOnly] = useState(true);
  const [showResidents, setShowResidents] = useState(true);
  const [simulationPaused, setSimulationPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [simulationReplay, setSimulationReplay] = useState(0);
  const [simulationElapsed, setSimulationElapsed] = useState(0);
  const simulationFinished = simulationElapsed >= RESPONDER_DEMO_DURATION;
  const selectedRoute = selection?.kind === 'responder' ? responderRoutes.find(route => route.teamId === selection.id) : null;
  const [fenceEditor, setFenceEditor] = useState(false);
  const [fenceDraft, setFenceDraft] = useState<GeofenceGeometry | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editingFenceId, setEditingFenceId] = useState<string | null>(null);
  const mapRef = useRef<OperationsMapHandle>(null);
  const captureTourState = () => ({ activeView, section, region, filter, selection, layers, basemap, alertsVisible, selectedFenceId, fenceEditor, fenceDraft, draftName, editingFenceId, showResidents, simulationPaused, broadcastGroup, broadcastActiveOnly, broadcastTab, scrollY: window.scrollY, mapView: mapRef.current?.captureView() });
  const beforeTour = useRef<ReturnType<typeof captureTourState> | null>(null);
  const startTour = () => { beforeTour.current = captureTourState(); setTourPlaying(true); setTourIndex(0); setTourRun(value => value + 1); };
  const exitTour = () => {
    const previous = beforeTour.current;
    if (previous) {
      setActiveView(previous.activeView); setSection(previous.section); setRegion(previous.region); setFilter(previous.filter);
      setSelection(previous.selection); setLayers(previous.layers); setBasemap(previous.basemap); setAlertsVisible(previous.alertsVisible);
      setSelectedFenceId(previous.selectedFenceId); setFenceEditor(previous.fenceEditor); setFenceDraft(previous.fenceDraft);
      setDraftName(previous.draftName); setEditingFenceId(previous.editingFenceId); setShowResidents(previous.showResidents);
      setSimulationPaused(previous.simulationPaused); setBroadcastGroup(previous.broadcastGroup); setBroadcastActiveOnly(previous.broadcastActiveOnly); setBroadcastTab(previous.broadcastTab);
      requestAnimationFrame(() => {
        if (previous.mapView) mapRef.current?.restoreView(previous.mapView);
        window.scrollTo({ top: previous.scrollY, behavior: 'instant' });
        document.querySelector<HTMLButtonElement>('.ops-demo-button')?.focus({ preventScroll: true });
      });
    }
    setTourIndex(null); beforeTour.current = null;
  };
  const incidents = useMemo(() => getIncidents(region, filter), [region, filter]);
  const regionalIncidents = useMemo(() => getIncidents(region), [region]);
  const selected = getSelection(selection);
  const activeTeams = responderTeams.filter((team) => ['deployed', 'active'].includes(team.status));
  const totalPersonnel = responderTeams.reduce((total, team) => total + team.personnel, 0);
  const fieldPersonnel = activeTeams.reduce((total, team) => total + team.personnel, 0);
  const priorityIncidents = regionalIncidents.filter((event) => ['critical', 'high'].includes(event.severity));
  useEffect(() => {
    if (geofences.every(isAlertGeofence)) {
      try { localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(geofences)); }
      catch { toast.error('Geofence storage is full. Remove unused saved areas and save again.'); }
    }
  }, [geofences]);
  useEffect(() => { if (tourIndex === null) localStorage.setItem('ecc-map-selected-geofence', JSON.stringify(selectedFenceId)); }, [selectedFenceId, tourIndex]);

  useEffect(() => {
    if (tourIndex === null) return;
    const step = presentationSteps[tourIndex];
    const composing = step.id === 'exposure' || step.id === 'message';
    setActiveView('map'); setRegion('metro-manila'); setFilter('all');
    setPresentationAreas(step.id === 'geofence' ? demoGeofences.filter(area => area.id !== presentationArea.id) : demoGeofences);
    setSelectedFenceId(step.id === 'geofence' ? null : presentationArea.id);
    setFenceDraft(null); setFenceEditor(false); setEditingFenceId(null);
    setLayers({ incidents: true, responders: true, infrastructure: false, risk: true });
    setAlertsVisible(false); setShowResidents(true);
    setSection(composing ? 'broadcast' : null); setBroadcastTab('compose'); setBroadcastGroup('pwd'); setBroadcastActiveOnly(true);
    setSelection(null); setSimulationPaused(true);
    if (step.id === 'welcome' || step.id === 'map') setBasemap('satellite');
    if (step.id === 'responders') { setSimulationElapsed(0); setSimulationReplay(value => value + 1); }
    const frame = requestAnimationFrame(() => {
      if (step.id === 'geofence' || step.id === 'population' || step.id === 'groups') mapRef.current?.frameDemoArea(presentationArea);
      else if (step.id === 'welcome' || step.id === 'map' || step.id === 'complete') mapRef.current?.reset();
    });
    return () => cancelAnimationFrame(frame);
  }, [tourIndex, tourRun]);

  useEffect(() => {
    const syncView = () => { setActiveView(window.location.hash === '#/cctv' ? 'cctv' : 'map'); setSection(null); };
    window.addEventListener('popstate', syncView);
    window.addEventListener('hashchange', syncView);
    return () => { window.removeEventListener('popstate', syncView); window.removeEventListener('hashchange', syncView); };
  }, []);
  useEffect(() => { document.title = activeView === 'cctv' ? 'CCTV Monitoring — TANOVIQ' : 'TANOVIQ — Emergency Operations'; }, [activeView]);
  const openView = (view: 'map' | 'cctv') => {
    const hash = view === 'cctv' ? '#/cctv' : '';
    if (tourIndex === null && window.location.hash !== hash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    setActiveView(view); setSection(null);
  };

  const reviewRecipients = (group: AudienceGroup = 'all', activeOnly = true) => {
    setTeamGroupId(undefined); setBroadcastGroup(group); setBroadcastActiveOnly(activeOnly); setBroadcastTab('compose'); setSection('broadcast');
  };
  const groupBroadcast = (id:string) => { setTeamGroupId(id);setBroadcastTab('compose');setSection('broadcast'); };
  const selectFence = (id: string) => {
    setSelectedFenceId(id); setFenceDraft(null); setSelection(null); setFenceEditor(true);
  };

  const drawFence = (shape: GeofenceShape) => {
    setSelection(null);
    setEditingFenceId(null);
    setDraftName(`Alert area ${geofences.length + 1}`);
    setFenceDraft({ shape, points: [] });
    setFenceEditor(true);
  };
  const addFencePoint = (point: GeofencePoint) => setFenceDraft((current) => {
    if (!current || (current.shape !== 'polygon' && current.points.length >= 2) || current.points.length >= 100) return current;
    return { ...current, points: [...current.points, { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) }] };
  });
  const saveFence = () => {
    if (!fenceDraft || getGeofenceError(fenceDraft) || !draftName.trim()) return;
    const saved = { ...fenceDraft, id: tourIndex !== null ? presentationArea.id : editingFenceId || crypto.randomUUID(), name: draftName.trim() };
    const next = editingFenceId ? visibleGeofences.map(area => area.id === editingFenceId ? saved : area) : [...visibleGeofences.filter(area => area.id !== saved.id), saved];
    if (tourIndex === null) {
      try { localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(next)); }
      catch { toast.error('Unable to save this geofence. Local storage is full.'); return; }
    }
    updateAreas(next);
    setSelectedFenceId(saved.id);
    setFenceDraft(null);
    if (tourIndex === null) toast.success('Geofence saved on this workstation.');
  };

  const previewBoundary = (place: BoundaryPlace, geometry: GeofenceGeometry) => {
    openView('map'); setSection(null); setSelection(null); setAlertsVisible(false);
    const sourceId = geometry.source?.recordId;
    const existing = sourceId ? visibleGeofences.find(area => area.source?.recordId === sourceId) : undefined;
    setFenceEditor(true); setEditingFenceId(null);
    if (existing) {
      setSelectedFenceId(existing.id); setFenceDraft(null);
      toast.info('This geofence is already saved on this workstation.');
    } else {
      setDraftName(place.label.slice(0,60)); setFenceDraft(geometry);
    }
    requestAnimationFrame(() => mapRef.current?.frameDemoArea(existing || geometry));
  };
  const focusSearch = () => { openView('map'); setSection(null); requestAnimationFrame(() => document.getElementById('operations-place-search')?.focus()); };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (tourIndex !== null) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); focusSearch();
      }
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tourIndex]);

  const locate = (next: MapSelection) => {
    openView('map');
    const event = disasterEvents.find((item) => item.id === next.id);
    if (event && event.lat >= 15) setRegion('all');
    if (next.kind === 'incident') setFilter('all');
    const layer = next.kind === 'incident' ? 'incidents' : next.kind === 'responder' ? 'responders' : 'infrastructure';
    setLayers((current) => ({ ...current, [layer]: true }));
    setSelection(next); setSection(null);
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => {
        document.getElementById('operations-main')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    }
  };
  const changeFilter = (value: IncidentFilter) => { setFilter(value); setSelection(null); };
  const locatePhone = (point?: GeofencePoint) => {
    setLiveMode(true); setShowResidents(true); setSelection(null);
    setFenceEditor(false); setFenceDraft(null); openView('map');
    requestAnimationFrame(() => {
      if (point) mapRef.current?.focusPoint(point);
      else mapRef.current?.focusResidents();
      if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('operations-main')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  const replayRoutes = () => { setLayers(current => ({ ...current, responders: true })); setSimulationElapsed(0); setSimulationReplay(value => value + 1); setSimulationPaused(false); };
  const toggleRoutes = () => { if (simulationFinished) replayRoutes(); else if (!layers.responders) { setLayers(current => ({ ...current, responders: true })); setSimulationPaused(false); } else setSimulationPaused(value => !value); };

  return <div className={`ops-app${activeView === 'cctv' ? ' ops-app--cctv' : ''}`}>
    <a className="ops-skip-link" href={activeView === 'cctv' ? '#cctv-main' : '#operations-main'} onClick={event => { event.preventDefault(); document.getElementById(activeView === 'cctv' ? 'cctv-main' : 'operations-main')?.focus(); }}>Skip to operations</a>
    <OperationsMap ref={mapRef} incidents={liveView ? [] : incidents} layers={liveView ? { incidents: false, responders: false, infrastructure: false, risk: false } : layers} region={region} basemap={basemap} selection={selection} onSelect={setSelection} publicReports={tourIndex === null && !liveView ? publicReports : []}
      residents={liveView ? realUsers : undefined} snapshotAt={liveView ? live.locationNow : undefined} live={liveView}
      geofence={fenceDraft || alertGeofence} drawing={!!fenceDraft && fenceDraft.shape !== 'boundary'} previewing={!!fenceDraft} onGeofencePoint={addFencePoint}
      areas={visibleGeofences} selectedAreaId={fenceDraft ? null : selectedFenceId} onSelectGeofence={selectFence} showResidents={showResidents}
      simulationPaused={simulationPaused || activeView === 'cctv' || (tourIndex !== null && !tourPlaying)} simulationReplay={simulationReplay} onSimulationTick={setSimulationElapsed}
      onGeofenceMove={(index, point) => setFenceDraft((current) => current ? { ...current, points: current.points.map((previous, i) => i === index ? point : previous) } : current)} />
    <header className="ops-header">
      <button className="ops-brand gsam-brand" onClick={() => { openView('map'); setSelection(null); mapRef.current?.reset(); }} aria-label="TANOVIQ home">

        <span>TANOVIQ<span className="ops-brand-caption">See Risk Before It Strikes.</span></span>
      </button>
      <nav className="ops-nav" aria-label="Main navigation">
        <button data-demo="nav-map" className={activeView === 'map' && !section ? 'is-active' : ''} aria-current={activeView === 'map' && !section ? 'page' : undefined} onClick={() => openView('map')}>Live overview<span className="ops-live-dot" /></button>
        {!liveView && <button data-demo="nav-cctv" className={activeView === 'cctv' && !section ? 'is-active' : ''} aria-current={activeView === 'cctv' && !section ? 'page' : undefined} onClick={() => openView('cctv')}><Video size={12} />CCTV</button>}
        <button className={section === 'connected' ? 'is-active' : ''} onClick={() => setSection('connected')}><Smartphone size={12} />Personnel</button>
        {liveView && <button className={section === 'groups' ? 'is-active' : ''} onClick={() => setSection('groups')}><Users size={13} />Groups</button>}
        {navigation.filter(([id]) => !liveView || id === 'public').map(([id, label]) => <button key={id} className={section === id ? 'is-active' : ''} onClick={() => setSection(id)}>{label}{id === 'incidents' && <span className="ops-nav-count">{regionalIncidents.length}</span>}{id === 'public' && (liveView ? live.state?.requests.filter(openRequest).length || 0 : publicPending) > 0 && <span className="ops-nav-count">{liveView ? live.state?.requests.filter(openRequest).length : publicPending}</span>}</button>)}
        <button onClick={onOpenWorkspace}>Workspace<ArrowUpRight size={12} /></button>
      </nav>
      <div className="ops-header-actions">
        <div className="ops-data-modes" role="group" aria-label="Data source"><button aria-pressed={liveView} className={liveView ? 'is-active' : ''} onClick={() => locatePhone()}>Live data</button><button aria-pressed={!liveView} className={!liveView ? 'is-active' : ''} onClick={() => { setLiveMode(false); setSection(null); }}>Demo data</button></div>
        <a href="#/public" target="_blank" rel="noreferrer" className="ops-public-app-link" aria-label="Open public mobile app" title="Open public mobile app"><Smartphone size={14} /><span>Personnel app</span></a>
        <button className="ops-demo-button" onClick={startTour} aria-label="Start guided demo"><Play size={12} />Demo</button>
        <PlaceSearch onPreview={previewBoundary} onClear={() => { if (fenceDraft?.shape === 'boundary') { setFenceDraft(null); setFenceEditor(false); } }} />
        <span className="ops-header-divider" />
        <CommandNotifications onOpen={destination => { setLiveMode(true); if (destination === 'broadcast') setBroadcastTab('history'); setSection(destination); }} />
        <button className="ops-avatar" onClick={() => setSection(liveView ? 'connected' : 'users')} aria-label="Open team and access">{liveView ? live.state?.user.name.charAt(0) || 'IN' : 'MS'}</button>
      </div>
    </header>

    <main id="operations-main" className="ops-main" tabIndex={-1} style={activeView === 'cctv' ? { display: 'none' } : undefined}>
      <div className="ops-mobile-heading"><span>Live operations</span><span className="ops-demo-badge">{liveView ? 'Connected data' : 'Demo data'}</span></div>
      {liveView ? <ConnectedSidebar area={alertGeofence} draft={fenceDraft} onChooseArea={() => setFenceEditor(true)} onBroadcast={reviewRecipients} onPeople={() => setSection('connected')} onInbox={() => setSection('public')} onGroups={()=>setSection('groups')} onGroupBroadcast={groupBroadcast} /> : <CommandSidebar saved={alertGeofence} draft={fenceDraft} messages={messages} onReview={reviewRecipients}
        publicPending={publicPending} publicSafe={publicState.checkIns.length} onPublicInbox={() => setSection('public')}
        onChooseArea={() => setFenceEditor(true)} onHistory={() => { setBroadcastTab('history'); setSection('broadcast'); }} />}

      <div className="ops-map-heading gsam-map-heading">
        <div className="ops-eyebrow"><span className="ops-live-dot" />RISK &amp; RESPONSE<span className="ops-eyebrow-line" /></div>
        <h1>Live Operations Map</h1>
        <div className="ops-map-tools">
          {!liveView && <label className="ops-region"><MapPin size={13} /><select aria-label="Operations region" value={region} onChange={(event) => { setRegion(event.target.value as Region); setSelection(null); }}><option value="metro-manila">Metro Manila</option><option value="all">All regions</option></select><ChevronDown size={12} /></label>}
          <Popover><PopoverTrigger asChild><button className="ops-map-tool"><Layers size={13} />Layers<span>{Object.values(layers).filter(Boolean).length}</span></button></PopoverTrigger><PopoverContent className="ops-popover" align="start"><h3>Map layers</h3>{Object.entries(layerLabels).map(([key, label]) => <label key={key}><input type="checkbox" checked={layers[key as keyof MapLayers]} onChange={() => { setLayers((current) => ({ ...current, [key]: !current[key as keyof MapLayers] })); setSelection(null); }} />{label}</label>)}<p>Toggle the information shown on your map.</p></PopoverContent></Popover>
          <button className="ops-map-tool" aria-label="Geofence alert area" aria-expanded={fenceEditor} onClick={() => {
            setSelection(null);
            if (fenceEditor) { setFenceEditor(false); setFenceDraft(null); }
            else if (visibleGeofences.length) setFenceEditor(true);
            else drawFence('polygon');
          }}><PenLine size={13} />Geofence{alertGeofence && <span>✓</span>}</button>
          <button className="ops-map-tool" aria-pressed={showResidents} onClick={() => setShowResidents(current => !current)}><Users size={13} />App users<span>{showResidents ? 'On' : 'Off'}</span></button>
        </div>
        {!liveView && <div className="ops-map-filters" role="group" aria-label="Filter map incidents">{(['all', 'priority', 'critical', 'flood', 'typhoon'] as const).map((value) => <button key={value} onClick={() => changeFilter(value)} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value}>{value === 'all' ? 'All events' : value === 'priority' ? 'Priority' : value === 'critical' ? 'Critical' : value === 'flood' ? 'Flood' : 'Typhoon'}</button>)}</div>}
      </div>

      {fenceEditor && <GeofenceTools saved={alertGeofence} draft={fenceDraft} areas={visibleGeofences} draftName={draftName}
        onSelect={selectFence} onNew={() => drawFence('polygon')}
        onDraw={(shape) => setFenceDraft({ shape, points: [] })} onSave={saveFence} onCenterPoint={() => mapRef.current?.addCenterPoint()}
        onUndo={() => setFenceDraft((current) => current ? { ...current, points: current.points.slice(0, -1) } : current)}
        onCancel={() => { setFenceDraft(null); if (!alertGeofence) setFenceEditor(false); }}
        onClose={() => { setFenceEditor(false); setFenceDraft(null); }}
        onEdit={() => { if (alertGeofence) { setEditingFenceId(alertGeofence.id); setDraftName(alertGeofence.name); setFenceDraft({ shape: alertGeofence.shape, points: alertGeofence.points.map((point) => ({ ...point })) }); } }}
        onRemove={() => { updateAreas(current => current.filter(area => area.id !== selectedFenceId)); setSelectedFenceId(null); setFenceDraft(null); }}
        onRename={(name) => fenceDraft ? setDraftName(name) : updateAreas(current => current.map(area => area.id === selectedFenceId ? { ...area, name } : area))}
        onFocus={() => mapRef.current?.focusGeofence()}
        onBroadcast={() => reviewRecipients()} />}

      {!liveView && alertsVisible && !fenceEditor && !selectedRoute && <aside className="ops-alerts ops-glass" aria-label="Priority alerts">
        <div className="ops-card-heading"><h2><span className="ops-alert-dot" />Priority alerts<span className="ops-count-badge">{priorityIncidents.length}</span></h2><button className="ops-small-icon" onClick={() => setAlertsVisible(false)} aria-label="Close priority alerts"><X size={14} /></button></div>
        <div className="ops-alerts-caption">Events that need your attention</div>
        {priorityIncidents.map((event) => <article key={event.id} className={`ops-alert-card severity-${event.severity}`}>
          <button className="ops-alert-toggle" aria-expanded={expandedAlert === event.id} aria-controls={`alert-${event.id}`} onClick={() => setExpandedAlert((current) => current === event.id ? null : event.id)}><IncidentIcon event={event} /><span><strong>{event.title}</strong><small>{formatRelativeTime(event.createdAt)} · {event.location}</small></span><ChevronDown size={13} className={expandedAlert === event.id ? 'is-rotated' : ''} /></button>
          {expandedAlert === event.id && <div className="ops-alert-detail" id={`alert-${event.id}`}><span className="ops-severity-label">{event.severity} priority</span><p>{event.description}</p><div className="ops-alert-source"><Radio size={12} />{event.source} report</div><button onClick={() => locate({ kind: 'incident', id: event.id })}>Locate incident<ArrowUpRight size={13} /></button></div>}
        </article>)}
        <button className="ops-all-alerts" onClick={() => { changeFilter('all'); setSection('incidents'); }}>View all {regionalIncidents.length} incidents<ChevronRight size={13} /></button>
      </aside>}

      {!liveView && selectedRoute && !fenceEditor && <ResponderRouteCard route={selectedRoute} elapsed={simulationElapsed} paused={simulationPaused || !layers.responders}
        onToggle={toggleRoutes} onReplay={replayRoutes} onClose={() => setSelection(null)}
        onFocus={() => { setLayers(current => ({ ...current, responders: true })); mapRef.current?.focusRoute(selectedRoute.teamId); }} />}
      {!liveView && selected && !selectedRoute && <section className="ops-selection ops-glass" aria-label="Selected map location">
        <div className="ops-card-heading"><span className="ops-selection-kind">{selection?.kind} details</span><button className="ops-small-icon" onClick={() => setSelection(null)} aria-label="Close location details"><X size={14} /></button></div>
        <h2>{selected.name}</h2><p><MapPin size={12} />{selected.location}</p><p>{selected.detail}</p><span className="ops-selection-status" style={{ color: selected.color }}><i style={{ background: selected.color }} />{selected.status.replaceAll('-', ' ')}</span>
      </section>}

      <div className="ops-map-controls" aria-label="Map controls"><div><button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus size={17} /></button><button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus size={17} /></button><span /><button onClick={() => { setSelection(null); mapRef.current?.reset(); }} aria-label="Reset map view"><Crosshair size={17} /></button><button onClick={onFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><Expand size={16} /></button></div><div className="ops-basemap-controls"><button data-demo="satellite" className={basemap === 'satellite' ? 'is-active' : ''} aria-pressed={basemap === 'satellite'} onClick={() => setBasemap('satellite')}>Satellite</button><button data-demo="street" className={basemap === 'street' ? 'is-active' : ''} aria-pressed={basemap === 'street'} onClick={() => setBasemap('street')}>Street</button></div>
        {!liveView && <div className="ops-route-playback"><span className="ops-route-playback-label">Demo routes · 8×</span><button onClick={toggleRoutes} disabled={!!fenceDraft || !layers.responders} aria-label={simulationFinished ? 'Replay responder simulation' : simulationPaused ? 'Play responder simulation' : 'Pause responder simulation'}>{simulationFinished ? <RotateCcw size={14} /> : simulationPaused ? <Play size={14} /> : <Pause size={14} />}</button><button onClick={replayRoutes} disabled={!!fenceDraft || !layers.responders} aria-label="Restart responder routes"><RotateCcw size={13} /></button><button className="ops-ambulance-shortcut" disabled={!!fenceDraft} onClick={() => { setFenceEditor(false); locate({ kind: 'responder', id: 'team-2' }); }}><Ambulance size={15} />Ambulance</button></div>}
      </div>

      <div className="ops-bottom-panels">
        <PopulationPanel saved={alertGeofence} draft={fenceDraft} onReview={reviewRecipients} onChooseArea={() => setFenceEditor(true)} residents={liveView ? realUsers : undefined} snapshotAt={liveView ? live.locationNow : undefined} live={liveView} />
        {liveView ? <section className="ops-glass ops-priorities"><div className="ops-card-heading"><h2>Connected response</h2><span className="ops-demo-badge">{live.connection}</span></div><div className="ops-live-summary"><span><strong>{approved ? live.state!.requests.filter(openRequest).length : '—'}</strong>Open requests</span><span><strong>{approved ? live.state!.users.filter(user => user.safeAt).length : '—'}</strong>Safe check-ins</span><span><strong>{approved ? live.state!.alerts.length : '—'}</strong>Broadcasts</span></div><p className="ops-command-note">{approved ? 'Updates arrive from registered personnel. Personnel locations are tracked only while on duty.' : 'Open Personnel to sign in or register. Live locations require approved operator access.'}</p><button className="ops-command-link" onClick={() => setSection(approved ? 'public' : 'connected')}>{approved ? 'Review field updates' : 'Sign in to live operations'}<ArrowUpRight size={13} /></button></section> : <section className="ops-glass ops-priorities" aria-labelledby="incident-priorities-title">
          <div className="ops-card-heading">
            <h2 id="incident-priorities-title">Incident priorities</h2>
            <span className="ops-priority-scope">{region === 'all' ? 'All regions' : 'Metro Manila'}</span>
          </div>
          <div className="ops-large-metric">
            {priorityIncidents.length}<span>{priorityIncidents.length === 0 ? 'no priority incidents' : 'critical or high severity'}</span>
          </div>
          <dl className="ops-priority-counts">
            {(['critical', 'high', 'medium', 'low'] as const).map((severity) => <div key={severity}>
              <dt><i style={{ background: severityColors[severity] }} />{severity}</dt>
              <dd>{regionalIncidents.filter((event) => event.severity === severity).length}</dd>
            </div>)}
          </dl>
          <div className="ops-priority-footer">
            <span>{regionalIncidents.length} total incidents</span>
            <button onClick={() => {
              setIncidentQuery('');
              changeFilter(priorityIncidents.length ? 'priority' : 'all');
              setSection('incidents');
            }}>
              {priorityIncidents.length ? 'Review priorities' : 'View incidents'}<ArrowUpRight size={12} />
            </button>
          </div>
        </section>}
      </div>
    </main>

    {activeView === 'cctv' && <CctvMonitoring areas={visibleGeofences} presentationMode={tourIndex !== null} presentationPaused={!tourPlaying}
      onOpenArea={id => { openView('map'); setSelectedFenceId(id); setFenceDraft(null); setFenceEditor(true); setSelection(null); requestAnimationFrame(() => mapRef.current?.focusGeofence()); }}
      onPreviewAlert={id => { setSelectedFenceId(id); reviewRecipients(); }} />}

    <footer className="ops-footer"><div><ShieldCheck size={12} /><span>TANOVIQ command center</span><span className="ops-footer-separator">/</span><span>{liveView ? 'Connected pilot' : 'Demo workspace'}</span></div><div className="ops-map-legend">{liveView ? <><span><i className="ops-legend-team" />Shared device locations</span><span>Boundaries are alert areas</span></> : <><span><i className="ops-legend-incident" />Incidents</span><span><i className="ops-legend-team" />Responders</span><span><i className="ops-legend-site" />Facilities</span></>}</div><div><OperationsClock /><button className="ops-small-icon" aria-label="Help and keyboard shortcuts" onClick={() => setSection('help')}><CircleHelp size={14} /></button></div></footer>

    <Dialog open={section !== null} modal={tourIndex === null} onOpenChange={(open) => { if (!open && tourIndex === null) setSection(null); }}><DialogContent className={`ops-dialog${section === 'help' ? ' ops-dialog--compact' : ''}${section === 'broadcast' ? ' ops-dialog--broadcast' : ''}${section === 'groups' ? ' ops-dialog--groups' : ''}`}
      onInteractOutside={event => { if (tourIndex !== null) event.preventDefault(); }}
      onOpenAutoFocus={event => { if (tourIndex !== null) event.preventDefault(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); if (tourIndex === null) document.getElementById('operations-place-search')?.focus({ preventScroll: true }); }}>
      <DialogHeader><div className="ops-eyebrow">TANOVIQ / {liveView ? 'CONNECTED OPERATIONS' : 'DEMO OPERATIONS'}</div><DialogTitle>{section ? sectionTitles[section] : ''}</DialogTitle><DialogDescription>{liveView && (section === 'public' || section === 'broadcast') ? 'Live updates from registered accounts. Actual receipts appear when personnel open or read their messages.' : section ? sectionDescriptions[section] : ''}</DialogDescription></DialogHeader>
      {section === 'groups' && <GroupsWorkspace onBroadcast={groupBroadcast} />}
      {section === 'connected' && <ConnectedOperations onLocate={locatePhone} onShowLocations={() => locatePhone()} locationsVisible={liveView && showResidents} />}
      {section === 'incidents' && <><div className="ops-incident-toolbar"><div className="ops-dialog-search"><Search size={16} /><input aria-label="Filter incidents" placeholder="Search incidents…" value={incidentQuery} onChange={(event) => setIncidentQuery(event.target.value)} /></div><select aria-label="Incident category" value={filter} onChange={(event) => changeFilter(event.target.value as IncidentFilter)}><option value="all">All events</option><option value="priority">Critical &amp; high priority</option><option value="critical">Critical priority</option><option value="flood">Flood</option><option value="typhoon">Typhoon</option></select></div><div className="ops-incident-list">{getIncidents(region, filter, incidentQuery).map((event) => <button key={event.id} onClick={() => locate({ kind: 'incident', id: event.id })}><IncidentIcon event={event} /><span><strong>{event.title}</strong><small>{event.location} · {formatRelativeTime(event.createdAt)}</small><p>{event.description}</p></span><span className={`ops-severity-pill severity-${event.severity}`}>{event.severity}</span><ArrowUpRight size={15} /></button>)}{!getIncidents(region, filter, incidentQuery).length && <p className="ops-empty">No matching incidents. Adjust your search or event filter.</p>}</div></>}
      {section === 'responders' && <><div className="ops-dialog-summary"><span><strong>{totalPersonnel}</strong> total personnel</span><span><strong>{activeTeams.length}</strong> active teams</span><span><strong>{fieldPersonnel}</strong> in the field</span></div><div className="ops-dialog-team-grid">{responderTeams.map((team) => <TeamCard key={team.id} team={team} onSelect={() => locate({ kind: 'responder', id: team.id })} />)}</div></>}
      {section === 'analytics' && <div className="ops-legacy-panels ops-analytics-grid"><RiskMonitoring /><SystemHealth /></div>}
      {section === 'activity' && <div className="ops-legacy-panels"><AuditLogs logs={auditLogs} /></div>}
      {section === 'users' && <div className="ops-legacy-panels"><UserManagement /></div>}
      {section === 'public' && (liveView ? <ConnectedOperations tab="inbox" onLocate={locatePhone} /> : <PublicActivityPanel state={publicState} onLocate={point => { openView('map'); setSelection(null); setFenceEditor(false); setAlertsVisible(false); requestAnimationFrame(() => mapRef.current?.focusPoint(point)); }} />)}
      {section === 'broadcast' && <><div className="ops-dialog-tabs" role="group" aria-label="Broadcast view"><button className={broadcastTab === 'compose' ? 'is-active' : ''} aria-pressed={broadcastTab === 'compose'} onClick={() => setBroadcastTab('compose')}><Send size={14} />Compose broadcast</button><button className={broadcastTab === 'history' ? 'is-active' : ''} aria-pressed={broadcastTab === 'history'} onClick={() => setBroadcastTab('history')}>Delivery history<span>{liveView ? live.state?.alerts.length || 0 : messages.length}</span></button></div>{liveView ? <ConnectedOperations key={`${broadcastTab}-${broadcastGroup}-${teamGroupId||''}`} initialTeamGroupId={teamGroupId} tab={broadcastTab} areas={visibleGeofences} selectedId={selectedFenceId} initialGroup={broadcastGroup} initialActiveOnly={broadcastActiveOnly} onSelectArea={setSelectedFenceId} onLocate={locatePhone} /> : broadcastTab === 'compose' ? <AudienceBroadcastPanel key={tourIndex === null ? 'operator' : 'presentation'} presentationMode={tourIndex !== null} areas={visibleGeofences} selectedId={selectedFenceId} initialGroup={broadcastGroup} initialActiveOnly={broadcastActiveOnly} onSelectArea={setSelectedFenceId} onSendMessage={onSendMessage} onHistory={() => setBroadcastTab('history')} /> : <div className="ops-legacy-panels"><MessageHistory messages={messages} /></div>}</>}
      {section === 'help' && <div className="ops-help"><p>Select any incident or team to see its location and details. Use <strong>Layers</strong> to adjust the map, or switch between satellite and street views. Select <strong>Geofence</strong> to draw a polygon, rectangle, or circle, save the area, and send an alert to it. Undo removes the last point; drag handles to edit. Keyboard users can pan the focused map with arrow keys and use <strong>Add center point</strong>.</p><p><kbd>Ctrl / ⌘ K</kbd> focuses place search. Search any Philippine barangay, city, municipality, or province, then save its mapped boundary. Map controls support keyboard navigation. Press <kbd>Esc</kbd> to dismiss details.</p><p><strong>Workspace</strong> opens your customizable dashboard, including the original geofence tools, widget library, layout presets, and light mode.</p><p className="ops-help-note">This project currently uses sample operational data. Broadcasts and audit changes stay in this browser. Connect production data and delivery services before operational use.</p><button className="ops-secondary-button" onClick={onOpenWorkspace}><LayoutGrid size={15} />Open workspace<ArrowUpRight size={14} /></button></div>}
    </DialogContent></Dialog>
    {tourIndex !== null && <PresentationTour key={tourRun} index={tourIndex} onNext={() => { if (tourIndex === presentationSteps.length - 1) exitTour(); else setTourIndex(tourStepIndex(tourIndex, 'next')); }} onBack={() => setTourIndex(tourStepIndex(tourIndex, 'back'))} onRestart={() => { setTourIndex(0); setTourRun(value => value + 1); }} onExit={exitTour}
      onPlayingChange={setTourPlaying} projectPoint={point => mapRef.current?.projectPoint(point) || null} onMapPoint={addFencePoint} />}
    <Toaster position="bottom-right" theme="dark" richColors closeButton />
  </div>;
}
