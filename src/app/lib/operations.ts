import { disasterEvents, infrastructureSites, responderTeams, type Severity } from './dashboard-data';

export type Region = 'metro-manila' | 'all';
export type IncidentFilter = 'all' | 'priority' | 'critical' | 'flood' | 'typhoon';
export type MapLayerId = 'incidents' | 'responders' | 'infrastructure' | 'risk';
export type MapLayers = Record<MapLayerId, boolean>;
export type MapSelection = { kind: 'incident' | 'responder' | 'infrastructure'; id: string };

export const severityColors: Record<Severity, string> = {
  critical: '#f57c76', high: '#e8b47d', medium: '#d5cd92', low: '#96bba8',
};

export function getIncidents(region: Region, filter: IncidentFilter = 'all', query = '') {
  const search = query.trim().toLowerCase();
  return disasterEvents.filter((event) =>
    (region === 'all' || event.lat < 15) &&
    (filter === 'all' || (filter === 'priority'
      ? event.severity === 'critical' || event.severity === 'high'
      : filter === 'critical' ? event.severity === 'critical' : event.type === filter)) &&
    (!search || `${event.title} ${event.location} ${event.type} ${event.severity}`.toLowerCase().includes(search)),
  );
}

export function getSelection(selection: MapSelection | null) {
  if (!selection) return null;
  if (selection.kind === 'incident') {
    const event = disasterEvents.find((item) => item.id === selection.id);
    return event ? { ...event, name: event.title, detail: event.description, status: event.severity, color: severityColors[event.severity] } : null;
  }
  if (selection.kind === 'responder') {
    const team = responderTeams.find((item) => item.id === selection.id);
    return team ? { ...team, detail: `${team.type} · ${team.personnel} personnel`, color: '#d0d0d0' } : null;
  }
  const site = infrastructureSites.find((item) => item.id === selection.id);
  return site ? { ...site, detail: site.type.replaceAll('-', ' '), color: '#a7c6d0' } : null;
}
