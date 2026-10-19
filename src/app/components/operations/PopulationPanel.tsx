import { ArrowUpRight, Users } from 'lucide-react';
import { getGeofenceError, type AlertGeofence, type GeofenceGeometry } from '../../lib/geofencing';
import { demoResidents, demoSnapshotAt, getExposure, residentGroups, type AudienceGroup, type Resident } from '../../lib/residents';

interface Props {
  saved: AlertGeofence | null;
  draft: GeofenceGeometry | null;
  onReview: (group: AudienceGroup) => void;
  onChooseArea: () => void;
  residents?: Resident[];
  snapshotAt?: string;
  live?: boolean;
}

export function PopulationPanel({ saved, draft, onReview, onChooseArea, residents = demoResidents, snapshotAt = demoSnapshotAt, live = false }: Props) {
  const geometry = draft || saved;
  const exposure = getExposure(residents, geometry, snapshotAt);
  const ready = !!geometry && exposure.valid;
  return <section className="ops-glass ops-population" aria-label="Geofence population">
    <div className="ops-card-heading"><h2><Users size={14} />Population in geofence</h2><span className="ops-demo-badge">{live ? 'Registered' : 'Demo'}</span></div>
    <div className="ops-population-scope">{draft ? 'Drawing preview · updates with boundary' : saved?.name || 'No area selected'}</div>
    {ready ? <>
      <div className="ops-population-total" aria-live="polite"><strong>{exposure.total}</strong><span>located app users<small><i />{exposure.active} active · {exposure.stale} stale locations</small></span></div>
      <div className="ops-population-groups">{residentGroups.map(group => <button key={group.id} title={group.description} disabled={!!draft || !saved?.name.trim()} onClick={() => onReview(group.id)} aria-label={`Review ${group.label}: ${exposure.counts[group.id]} in geofence`}><strong>{exposure.counts[group.id]}</strong><span>{group.label}</span></button>)}</div>
      <div className="ops-population-footer"><span>Groups overlap · last shared locations</span><button disabled={!!draft || !saved?.name.trim()} onClick={() => onReview('all')}>{draft ? 'Save to review' : 'Review recipients'}<ArrowUpRight size={12} /></button></div>
    </> : <div className="ops-population-empty"><p>{draft ? getGeofenceError(draft) : 'Select an area on the map to see residents and priority groups.'}</p>{!draft && <button className="ops-secondary-button" onClick={onChooseArea}>Choose or draw a geofence<ArrowUpRight size={13} /></button>}</div>}
    <p className="ops-population-note">{live ? 'Registered users with shared locations, not census population. Active = updated ≤5 min; groups self-reported.' : 'Demo app users, not census population. Active = seen within 5 min of snapshot.'}</p>
  </section>;
}
