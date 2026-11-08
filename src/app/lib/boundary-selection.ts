import { getGeofenceError, type AlertGeofence } from './geofencing.ts';
import { placeKey, type BoundarySelection } from './place-search.ts';

/** Prepare a complete addition before writing storage, so a failed batch changes nothing. */
export function addBoundaryGeofences(existing: AlertGeofence[], selected: BoundarySelection[], makeId = () => crypto.randomUUID()) {
  const known = new Set(existing.map(area => area.source?.recordId).filter(Boolean));
  const additions: AlertGeofence[] = [];
  for (const {place, geometry} of selected) {
    const error = getGeofenceError(geometry), key = placeKey(place);
    if (error || geometry.shape !== 'boundary' || geometry.source?.recordId !== key) throw new Error(error || 'A selected boundary is incomplete. Try again.');
    if (known.has(key)) continue;
    known.add(key);
    additions.push({...geometry,id:makeId(),name:place.label.slice(0,60)});
  }
  return {areas:[...existing,...additions],added:additions.length};
}
