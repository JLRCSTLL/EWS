import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowUpRight, Bell, ChevronDown, ChevronRight,
  CircleHelp, Crosshair, Expand, Flame, Layers, LayoutGrid, MapPin, Minus,
  Mountain, PenLine, Plus, Radio, Search, Send, ShieldCheck,
  Users, Waves, Wind, X,
} from 'lucide-react';
import { Toaster } from 'sonner';
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

type Section = 'incidents' | 'responders' | 'analytics' | 'activity' | 'broadcast' | 'search' | 'users' | 'help' | null;
interface Props extends WidgetRuntimeProps {
  onOpenWorkspace: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const incidentIcons = { typhoon: Wind, flood: Waves, earthquake: Activity, landslide: Mountain, fire: Flame };
const navigation = [
  ['incidents', 'Incidents'], ['responders', 'Responders'], ['analytics', 'Analytics'], ['activity', 'Activity'],
] as const;
const layerLabels: Record<keyof MapLayers, string> = {
  incidents: 'Incident markers', responders: 'Response teams', infrastructure: 'Critical facilities', risk: 'Risk zones',
};
const sectionTitles: Record<Exclude<Section, null>, string> = {
  incidents: 'Incident center', responders: 'Response teams', analytics: 'Operational analytics',
  activity: 'Activity log', broadcast: 'Broadcast center', search: 'Search your operations', users: 'Team & access', help: 'Your command center',
};
const sectionDescriptions: Record<Exclude<Section, null>, string> = {
  incidents: 'Review reported events and locate them on the map.',
  responders: 'Personnel, deployment status, and the latest field locations.',
  analytics: 'Risk exposure and system performance from the sample dataset.',
  activity: 'Recent configuration, access, and broadcast activity on this workstation.',
  broadcast: 'Demo workspace. Broadcasts are simulated locally; no messages are sent to the public.',
  search: 'Find an incident, response team, or critical facility. Ctrl / ⌘ K',
  users: 'Review the existing operator directory and access roles.',
  help: 'A clearer view of your emergency operations.',
};

function IncidentIcon({ event }: { event: DisasterEvent }) {
  const Icon = incidentIcons[event.type];
  return <span className={`ops-incident-icon severity-${event.severity}`}><Icon size={17} strokeWidth={1.5} /></span>;
}

function TeamCard({ team, onSelect }: { team: ResponderTeam; onSelect: () => void }) {
  const active = team.status === 'deployed' || team.status === 'active';
  return <button className="ops-team-card" onClick={onSelect} aria-label={`Locate ${team.name}`}>
    <div className="ops-card-heading"><span>{team.name}</span><ArrowUpRight size={13} /></div>
    <span className="ops-team-type">{team.type}</span>
    <div className="ops-team-visual">
      <div className="ops-team-orbit" aria-hidden="true"><Crosshair size={25} strokeWidth={0.9} /><span>{team.name[0]}</span></div>
      <div className="ops-team-personnel"><strong>{team.personnel}</strong><span>personnel</span></div>
    </div>
    <div className="ops-team-meta"><span className={active ? 'ops-status' : 'ops-status is-muted'}><i />{team.status}</span><Radio size={12} /></div>
    <div className="ops-team-location"><MapPin size={10} /><span>{team.location}</span></div>
    <div className="ops-team-updated">Updated {formatRelativeTime(team.lastUpdateAt)}</div>
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
  const [section, setSection] = useState<Section>(null);
  const [region, setRegion] = useState<Region>('metro-manila');
  const [filter, setFilter] = useState<IncidentFilter>('all');
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [layers, setLayers] = useState<MapLayers>({ incidents: true, responders: true, infrastructure: false, risk: true });
  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [alertsVisible, setAlertsVisible] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>('event-1');
  const [search, setSearch] = useState('');
  const [incidentQuery, setIncidentQuery] = useState('');
  const [broadcastTab, setBroadcastTab] = useState<'compose' | 'history'>('compose');
  const [geofences, setGeofences] = useState<AlertGeofence[]>(readGeofences);
  const [selectedFenceId, setSelectedFenceId] = useState<string | null>(readSelectedGeofence);
  const alertGeofence = geofences.find(area => area.id === selectedFenceId) || null;
  const [broadcastGroup, setBroadcastGroup] = useState<AudienceGroup>('all');
  const [broadcastActiveOnly, setBroadcastActiveOnly] = useState(true);
  const [showResidents, setShowResidents] = useState(true);
  const [fenceEditor, setFenceEditor] = useState(false);
  const [fenceDraft, setFenceDraft] = useState<GeofenceGeometry | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editingFenceId, setEditingFenceId] = useState<string | null>(null);
  const mapRef = useRef<OperationsMapHandle>(null);
  const incidents = useMemo(() => getIncidents(region, filter), [region, filter]);
  const regionalIncidents = useMemo(() => getIncidents(region), [region]);
  const selected = getSelection(selection);
  const activeTeams = responderTeams.filter((team) => ['deployed', 'active'].includes(team.status));
  const totalPersonnel = responderTeams.reduce((total, team) => total + team.personnel, 0);
  const fieldPersonnel = activeTeams.reduce((total, team) => total + team.personnel, 0);
  const priorityIncidents = regionalIncidents.filter((event) => ['critical', 'high'].includes(event.severity));
  const searchItems = [
    ...disasterEvents.map((item) => ({ id: item.id, name: item.title, detail: item.location, kind: 'incident' as const })),
    ...responderTeams.map((item) => ({ id: item.id, name: item.name, detail: item.location, kind: 'responder' as const })),
    ...infrastructureSites.map((item) => ({ id: item.id, name: item.name, detail: item.location, kind: 'infrastructure' as const })),
  ].filter((item) => `${item.name} ${item.detail} ${item.kind}`.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    if (geofences.every(isAlertGeofence)) localStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(geofences));
  }, [geofences]);
  useEffect(() => { localStorage.setItem('ecc-map-selected-geofence', JSON.stringify(selectedFenceId)); }, [selectedFenceId]);

  const reviewRecipients = (group: AudienceGroup = 'all', activeOnly = true) => {
    setBroadcastGroup(group); setBroadcastActiveOnly(activeOnly); setBroadcastTab('compose'); setSection('broadcast');
  };
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
    const saved = { ...fenceDraft, id: editingFenceId || crypto.randomUUID(), name: draftName.trim() };
    setGeofences(current => editingFenceId ? current.map(area => area.id === editingFenceId ? saved : area) : [...current, saved]);
    setSelectedFenceId(saved.id);
    setFenceDraft(null);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSection((current) => current === 'search' ? null : 'search');
      }
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const locate = (next: MapSelection) => {
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

  return <div className="ops-app">
    <a className="ops-skip-link" href="#operations-main">Skip to operations</a>
    <OperationsMap ref={mapRef} incidents={incidents} layers={layers} region={region} basemap={basemap} selection={selection} onSelect={setSelection}
      geofence={fenceDraft || alertGeofence} drawing={!!fenceDraft} onGeofencePoint={addFencePoint}
      areas={geofences} selectedAreaId={selectedFenceId} onSelectGeofence={selectFence} showResidents={showResidents}
      onGeofenceMove={(index, point) => setFenceDraft((current) => current ? { ...current, points: current.points.map((previous, i) => i === index ? point : previous) } : current)} />
    <header className="ops-header">
      <button className="ops-brand" onClick={() => { setSection(null); setSelection(null); mapRef.current?.reset(); }} aria-label="E-Ligtas home">
        <span className="ops-brand-mark"><ShieldCheck size={23} strokeWidth={1.35} /></span>
        <span>E-LIGTAS<span className="ops-brand-caption">EARLY WARNING SYSTEM</span></span>
      </button>
      <nav className="ops-nav" aria-label="Main navigation">
        <button className={!section ? 'is-active' : ''} aria-current={!section ? 'page' : undefined} onClick={() => setSection(null)}>Live overview<span className="ops-live-dot" /></button>
        {navigation.map(([id, label]) => <button key={id} className={section === id ? 'is-active' : ''} onClick={() => setSection(id)}>{label}{id === 'incidents' && <span className="ops-nav-count">{regionalIncidents.length}</span>}</button>)}
        <button onClick={onOpenWorkspace}>Workspace<ArrowUpRight size={12} /></button>
      </nav>
      <div className="ops-header-actions">
        <button className="ops-search-button" onClick={() => setSection('search')} aria-label="Search operations"><Search size={15} /><span>Search anything</span><kbd>⌘ K</kbd></button>
        <span className="ops-header-divider" />
        <button className="ops-icon-button ops-notifications" onClick={() => setAlertsVisible((value) => !value)} aria-label={alertsVisible ? 'Hide priority alerts' : 'Show priority alerts'} aria-pressed={alertsVisible}><Bell size={17} /><i /></button>
        <button className="ops-avatar" onClick={() => setSection('users')} aria-label="Open team and access">MS</button>
      </div>
    </header>

    <main id="operations-main" className="ops-main" tabIndex={-1}>
      <div className="ops-mobile-heading"><span>Emergency operations</span><span className="ops-demo-badge">Demo data</span></div>
      <CommandSidebar saved={alertGeofence} draft={fenceDraft} messages={messages} onReview={reviewRecipients}
        onChooseArea={() => setFenceEditor(true)} onHistory={() => { setBroadcastTab('history'); setSection('broadcast'); }} />

      <div className="ops-map-heading">
        <div className="ops-eyebrow"><span className="ops-live-dot" />SITUATIONAL AWARENESS<span className="ops-eyebrow-line" /></div>
        <h1>Emergency<br className="ops-title-break" /> operations<span>.</span></h1>
        <div className="ops-map-tools">
          <label className="ops-region"><MapPin size={13} /><select aria-label="Operations region" value={region} onChange={(event) => { setRegion(event.target.value as Region); setSelection(null); }}><option value="metro-manila">Metro Manila</option><option value="all">All regions</option></select><ChevronDown size={12} /></label>
          <Popover><PopoverTrigger asChild><button className="ops-map-tool"><Layers size={13} />Layers<span>{Object.values(layers).filter(Boolean).length}</span></button></PopoverTrigger><PopoverContent className="ops-popover" align="start"><h3>Map layers</h3>{Object.entries(layerLabels).map(([key, label]) => <label key={key}><input type="checkbox" checked={layers[key as keyof MapLayers]} onChange={() => { setLayers((current) => ({ ...current, [key]: !current[key as keyof MapLayers] })); setSelection(null); }} />{label}</label>)}<p>Toggle the information shown on your map.</p></PopoverContent></Popover>
          <button className="ops-map-tool" aria-label="Geofence alert area" aria-expanded={fenceEditor} onClick={() => {
            setSelection(null);
            if (fenceEditor) { setFenceEditor(false); setFenceDraft(null); }
            else if (geofences.length) setFenceEditor(true);
            else drawFence('polygon');
          }}><PenLine size={13} />Geofence{alertGeofence && <span>✓</span>}</button>
          <button className="ops-map-tool" aria-pressed={showResidents} onClick={() => setShowResidents(current => !current)}><Users size={13} />App users<span>{showResidents ? 'On' : 'Off'}</span></button>
        </div>
        <div className="ops-map-filters" role="group" aria-label="Filter map incidents">{(['all', 'priority', 'critical', 'flood', 'typhoon'] as const).map((value) => <button key={value} onClick={() => changeFilter(value)} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value}>{value === 'all' ? 'All events' : value === 'priority' ? 'Priority' : value === 'critical' ? 'Critical' : value === 'flood' ? 'Flood' : 'Typhoon'}</button>)}</div>
      </div>

      {fenceEditor && <GeofenceTools saved={alertGeofence} draft={fenceDraft} areas={geofences} draftName={draftName}
        onSelect={selectFence} onNew={() => drawFence('polygon')}
        onDraw={(shape) => setFenceDraft({ shape, points: [] })} onSave={saveFence} onCenterPoint={() => mapRef.current?.addCenterPoint()}
        onUndo={() => setFenceDraft((current) => current ? { ...current, points: current.points.slice(0, -1) } : current)}
        onCancel={() => { setFenceDraft(null); if (!alertGeofence) setFenceEditor(false); }}
        onClose={() => { setFenceEditor(false); setFenceDraft(null); }}
        onEdit={() => { if (alertGeofence) { setEditingFenceId(alertGeofence.id); setDraftName(alertGeofence.name); setFenceDraft({ shape: alertGeofence.shape, points: alertGeofence.points.map((point) => ({ ...point })) }); } }}
        onRemove={() => { setGeofences(current => current.filter(area => area.id !== selectedFenceId)); setSelectedFenceId(null); setFenceDraft(null); }}
        onRename={(name) => fenceDraft ? setDraftName(name) : setGeofences(current => current.map(area => area.id === selectedFenceId ? { ...area, name } : area))}
        onFocus={() => mapRef.current?.focusGeofence()}
        onBroadcast={() => reviewRecipients()} />}

      {alertsVisible && !fenceEditor && <aside className="ops-alerts ops-glass" aria-label="Priority alerts">
        <div className="ops-card-heading"><h2><span className="ops-alert-dot" />Priority alerts<span className="ops-count-badge">{priorityIncidents.length}</span></h2><button className="ops-small-icon" onClick={() => setAlertsVisible(false)} aria-label="Close priority alerts"><X size={14} /></button></div>
        <div className="ops-alerts-caption">Events that need your attention</div>
        {priorityIncidents.map((event) => <article key={event.id} className={`ops-alert-card severity-${event.severity}`}>
          <button className="ops-alert-toggle" aria-expanded={expandedAlert === event.id} aria-controls={`alert-${event.id}`} onClick={() => setExpandedAlert((current) => current === event.id ? null : event.id)}><IncidentIcon event={event} /><span><strong>{event.title}</strong><small>{formatRelativeTime(event.createdAt)} · {event.location}</small></span><ChevronDown size={13} className={expandedAlert === event.id ? 'is-rotated' : ''} /></button>
          {expandedAlert === event.id && <div className="ops-alert-detail" id={`alert-${event.id}`}><span className="ops-severity-label">{event.severity} priority</span><p>{event.description}</p><div className="ops-alert-source"><Radio size={12} />{event.source} report</div><button onClick={() => locate({ kind: 'incident', id: event.id })}>Locate incident<ArrowUpRight size={13} /></button></div>}
        </article>)}
        <button className="ops-all-alerts" onClick={() => { changeFilter('all'); setSection('incidents'); }}>View all {regionalIncidents.length} incidents<ChevronRight size={13} /></button>
      </aside>}

      {selected && <section className="ops-selection ops-glass" aria-label="Selected map location">
        <div className="ops-card-heading"><span className="ops-selection-kind">{selection?.kind} details</span><button className="ops-small-icon" onClick={() => setSelection(null)} aria-label="Close location details"><X size={14} /></button></div>
        <h2>{selected.name}</h2><p><MapPin size={12} />{selected.location}</p><p>{selected.detail}</p><span className="ops-selection-status" style={{ color: selected.color }}><i style={{ background: selected.color }} />{selected.status.replaceAll('-', ' ')}</span>
      </section>}

      <div className="ops-map-controls" aria-label="Map controls"><div><button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus size={17} /></button><button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus size={17} /></button><span /><button onClick={() => { setSelection(null); mapRef.current?.reset(); }} aria-label="Reset map view"><Crosshair size={17} /></button><button onClick={onFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><Expand size={16} /></button></div><div className="ops-basemap-controls"><button className={basemap === 'satellite' ? 'is-active' : ''} aria-pressed={basemap === 'satellite'} onClick={() => setBasemap('satellite')}>Satellite</button><button className={basemap === 'street' ? 'is-active' : ''} aria-pressed={basemap === 'street'} onClick={() => setBasemap('street')}>Street</button></div></div>

      <div className="ops-bottom-panels">
        <PopulationPanel saved={alertGeofence} draft={fenceDraft} onReview={reviewRecipients} onChooseArea={() => setFenceEditor(true)} />
        <section className="ops-glass ops-priorities" aria-labelledby="incident-priorities-title">
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
        </section>
      </div>
    </main>

    <footer className="ops-footer"><div><ShieldCheck size={12} /><span>E-Ligtas command center</span><span className="ops-footer-separator">/</span><span>Demo workspace</span></div><div className="ops-map-legend"><span><i className="ops-legend-incident" />Incidents</span><span><i className="ops-legend-team" />Responders</span><span><i className="ops-legend-site" />Facilities</span></div><div><OperationsClock /><button className="ops-small-icon" aria-label="Help and keyboard shortcuts" onClick={() => setSection('help')}><CircleHelp size={14} /></button></div></footer>

    <Dialog open={section !== null} onOpenChange={(open) => { if (!open) setSection(null); }}><DialogContent className={`ops-dialog${section === 'search' || section === 'help' ? ' ops-dialog--compact' : ''}${section === 'broadcast' ? ' ops-dialog--broadcast' : ''}`} onCloseAutoFocus={(event) => { event.preventDefault(); document.querySelector<HTMLButtonElement>('.ops-search-button')?.focus({ preventScroll: true }); }}>
      <DialogHeader><div className="ops-eyebrow">E-LIGTAS / OPERATIONS</div><DialogTitle>{section ? sectionTitles[section] : ''}</DialogTitle><DialogDescription>{section ? sectionDescriptions[section] : ''}</DialogDescription></DialogHeader>
      {section === 'search' && <><div className="ops-dialog-search"><Search size={18} /><input autoFocus aria-label="Search incidents, teams and facilities" placeholder="Search incidents, teams, or places…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="ops-search-results">{searchItems.map((item) => <button key={item.id} onClick={() => locate(item)}><span className={`ops-result-icon ops-result-icon--${item.kind}`}><MapPin size={16} /></span><span><strong>{item.name}</strong><small>{item.detail} · {item.kind}</small></span><ArrowUpRight size={15} /></button>)}{!searchItems.length && <p className="ops-empty">No results for “{search}”. Try a city or team name.</p>}</div></>}
      {section === 'incidents' && <><div className="ops-incident-toolbar"><div className="ops-dialog-search"><Search size={16} /><input aria-label="Filter incidents" placeholder="Search incidents…" value={incidentQuery} onChange={(event) => setIncidentQuery(event.target.value)} /></div><select aria-label="Incident category" value={filter} onChange={(event) => changeFilter(event.target.value as IncidentFilter)}><option value="all">All events</option><option value="priority">Critical &amp; high priority</option><option value="critical">Critical priority</option><option value="flood">Flood</option><option value="typhoon">Typhoon</option></select></div><div className="ops-incident-list">{getIncidents(region, filter, incidentQuery).map((event) => <button key={event.id} onClick={() => locate({ kind: 'incident', id: event.id })}><IncidentIcon event={event} /><span><strong>{event.title}</strong><small>{event.location} · {formatRelativeTime(event.createdAt)}</small><p>{event.description}</p></span><span className={`ops-severity-pill severity-${event.severity}`}>{event.severity}</span><ArrowUpRight size={15} /></button>)}{!getIncidents(region, filter, incidentQuery).length && <p className="ops-empty">No matching incidents. Adjust your search or event filter.</p>}</div></>}
      {section === 'responders' && <><div className="ops-dialog-summary"><span><strong>{totalPersonnel}</strong> total personnel</span><span><strong>{activeTeams.length}</strong> active teams</span><span><strong>{fieldPersonnel}</strong> in the field</span></div><div className="ops-dialog-team-grid">{responderTeams.map((team) => <TeamCard key={team.id} team={team} onSelect={() => locate({ kind: 'responder', id: team.id })} />)}</div></>}
      {section === 'analytics' && <div className="ops-legacy-panels ops-analytics-grid"><RiskMonitoring /><SystemHealth /></div>}
      {section === 'activity' && <div className="ops-legacy-panels"><AuditLogs logs={auditLogs} /></div>}
      {section === 'users' && <div className="ops-legacy-panels"><UserManagement /></div>}
      {section === 'broadcast' && <><div className="ops-dialog-tabs" role="group" aria-label="Broadcast view"><button className={broadcastTab === 'compose' ? 'is-active' : ''} aria-pressed={broadcastTab === 'compose'} onClick={() => setBroadcastTab('compose')}><Send size={14} />Compose broadcast</button><button className={broadcastTab === 'history' ? 'is-active' : ''} aria-pressed={broadcastTab === 'history'} onClick={() => setBroadcastTab('history')}>Delivery history<span>{messages.length}</span></button></div>{broadcastTab === 'compose' ? <AudienceBroadcastPanel areas={geofences} selectedId={selectedFenceId} initialGroup={broadcastGroup} initialActiveOnly={broadcastActiveOnly} onSelectArea={setSelectedFenceId} onSendMessage={onSendMessage} onHistory={() => setBroadcastTab('history')} /> : <div className="ops-legacy-panels"><MessageHistory messages={messages} /></div>}</>}
      {section === 'help' && <div className="ops-help"><p>Select any incident or team to see its location and details. Use <strong>Layers</strong> to adjust the map, or switch between satellite and street views. Select <strong>Geofence</strong> to draw a polygon, rectangle, or circle, save the area, and send an alert to it. Undo removes the last point; drag handles to edit. Keyboard users can pan the focused map with arrow keys and use <strong>Add center point</strong>.</p><p><kbd>Ctrl / ⌘ K</kbd> opens global search. Map controls support keyboard navigation. Press <kbd>Esc</kbd> to dismiss details.</p><p><strong>Workspace</strong> opens your customizable dashboard, including the original geofence tools, widget library, layout presets, and light mode.</p><p className="ops-help-note">This project currently uses sample operational data. Broadcasts and audit changes stay in this browser. Connect production data and delivery services before operational use.</p><button className="ops-secondary-button" onClick={onOpenWorkspace}><LayoutGrid size={15} />Open workspace<ArrowUpRight size={14} /></button></div>}
    </DialogContent></Dialog>
    <Toaster position="bottom-right" theme="dark" richColors closeButton />
  </div>;
}
