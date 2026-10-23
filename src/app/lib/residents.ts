import { getGeofenceError, isPointInGeofence, type AlertGeofence, type GeofenceGeometry } from './geofencing.ts';

export const residentGroups = [
  { id: 'pwd', label: 'PWD', description: 'Persons with disabilities' },
  { id: 'children', label: 'Children', description: 'Under 18 years old' },
  { id: 'seniors', label: 'Seniors', description: '60 years and older' },
  { id: 'pregnant', label: 'Pregnant', description: 'Self-reported pregnancy' },
  { id: 'responders', label: 'Responders', description: 'Registered responders' },
] as const;
export type ResidentGroup = typeof residentGroups[number]['id'];
export type AudienceGroup = 'all' | ResidentGroup;
export interface Resident {
  id: string;
  name: string;
  age: number;
  pwd: boolean;
  pregnant: boolean;
  responder: boolean;
  notificationsEnabled: boolean;
  location: { lat: number; lng: number; updatedAt: string; accuracy: number } | null;
}
export interface AudienceFilter { groups: AudienceGroup[]; activeOnly: boolean }
export interface AudienceSnapshot extends AudienceFilter {
  mode: 'demo';
  recipientIds: string[];
  activeCount: number;
  excludedCount: number;
  locationSnapshotAt: string;
}
export const demoSnapshotAt = new Date().toISOString();
export const demoGeofences: AlertGeofence[] = [
  { id: 'demo-manila', name: 'Manila riverfront', shape: 'rectangle', points: [{ lat: 14.575, lng: 120.965 }, { lat: 14.635, lng: 121.02 }] },
  { id: 'demo-qc', name: 'Quezon City north', shape: 'circle', points: [{ lat: 14.68, lng: 121.055 }, { lat: 14.713, lng: 121.055 }] },
  { id: 'demo-marikina', name: 'Marikina flood watch', shape: 'polygon', points: [{ lat: 14.625, lng: 121.08 }, { lat: 14.68, lng: 121.085 }, { lat: 14.69, lng: 121.13 }, { lat: 14.63, lng: 121.14 }] },
];

// Seeded, fictional records stay in the same places across reloads. No device location is read.
function createDemoResidents(): Resident[] {
  let seed = 45819;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const centers = [{ lat: 14.606, lng: 120.994 }, { lat: 14.68, lng: 121.055 }, { lat: 14.653, lng: 121.11 }];
  return Array.from({ length: 240 }, (_, index) => {
    const center = centers[Math.floor(random() * centers.length)];
    const lat = center.lat + (random() - .5) * .085;
    const lng = center.lng + (random() - .5) * .08;
    const age = index % 5 === 0 ? 8 + index % 10 : index % 6 === 0 ? 60 + index % 25 : 18 + index % 42;
    const minutes = index % 9 === 0 ? 90 + index % 60 : index % 4 === 0 ? 12 + index % 30 : 1 + index % 4;
    return {
      id: `demo-user-${String(index + 1).padStart(3, '0')}`, name: `Resident ${String(index + 1).padStart(3, '0')}`,
      age, pwd: index % 7 === 0, pregnant: age >= 18 && age < 45 && index % 11 === 0,
      responder: age >= 18 && age < 60 && index % 8 === 0, notificationsEnabled: index % 13 !== 0,
      location: index % 17 === 0 ? null : {
        lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), accuracy: 10 + index % 65,
        updatedAt: new Date(Date.parse(demoSnapshotAt) - minutes * 60000).toISOString(),
      },
    };
  });
}
export const demoResidents = createDemoResidents();

export function matchesGroup(user: Resident, group: AudienceGroup) {
  return group === 'all' || (group === 'pwd' && user.pwd) || (group === 'children' && user.age < 18) ||
    (group === 'seniors' && user.age >= 60) || (group === 'pregnant' && user.pregnant) || (group === 'responders' && user.responder);
}
export function locationAgeMinutes(user: Resident, at: string) {
  return user.location ? Math.max(0, (Date.parse(at) - Date.parse(user.location.updatedAt)) / 60000) : Infinity;
}
export function locationStatus(user: Resident, at: string) {
  const minutes = locationAgeMinutes(user, at);
  return !user.location ? 'unavailable' : minutes <= 5 ? 'active' : minutes <= 60 ? 'recent' : 'stale';
}
export function liveLocationLabel(updatedAt: string, at: string) {
  const seconds = Math.max(0,Math.floor((Date.parse(at)-Date.parse(updatedAt))/1000));
  if (!Number.isFinite(seconds)) return 'Location time unavailable';
  if (seconds <= 30) return `Live · ${seconds}s ago`;
  if (seconds < 60) return `Last seen ${seconds}s ago`;
  if (seconds < 3600) return `Last seen ${Math.floor(seconds/60)} min ago`;
  return `Last seen ${Math.floor(seconds/3600)} hr ago`;
}
export function audienceLabel(filter: AudienceFilter) {
  return filter.groups.includes('all') ? 'All app users' : residentGroups.filter(group => filter.groups.includes(group.id)).map(group => group.label).join(' + ');
}
export function isAudienceFilter(value: AudienceFilter) {
  return !!value && Array.isArray(value.groups) && value.groups.length > 0 && typeof value.activeOnly === 'boolean' &&
    value.groups.every(group => group === 'all' || residentGroups.some(item => item.id === group));
}
export function getExposure(users: Resident[], geometry: GeofenceGeometry | null, at: string) {
  const valid = !geometry || !getGeofenceError(geometry);
  const sharedLocation = (user: Resident) => user.location && Number.isFinite(user.location.lat) && Number.isFinite(user.location.lng) &&
    Math.abs(user.location.lat) <= 85 && Math.abs(user.location.lng) <= 180 && Number.isFinite(Date.parse(user.location.updatedAt));
  const unique = [...new Map(users.map(user => [user.id, user])).values()];
  const located = valid ? unique.filter(user => sharedLocation(user) && (!geometry || isPointInGeofence(user.location!, geometry))) : [];
  return {
    valid, located, total: located.length,
    active: located.filter(user => locationStatus(user, at) === 'active').length,
    stale: located.filter(user => locationStatus(user, at) === 'stale').length,
    unavailable: unique.filter(user => !sharedLocation(user)).length,
    counts: Object.fromEntries(residentGroups.map(group => [group.id, located.filter(user => matchesGroup(user, group.id)).length])) as Record<ResidentGroup, number>,
  };
}
export function getAudience(users: Resident[], geometry: GeofenceGeometry | null, filter: AudienceFilter, at: string) {
  const exposure = getExposure(users, geometry, at);
  if (!isAudienceFilter(filter)) return { ...exposure, matched: [], recipients: [], excluded: 0 };
  const matched = exposure.located.filter(user => filter.groups.some(group => matchesGroup(user, group)));
  const recipients = matched.filter(user => user.notificationsEnabled &&
    (filter.activeOnly ? locationStatus(user, at) === 'active' : ['active', 'recent'].includes(locationStatus(user, at))));
  return { ...exposure, matched, recipients, excluded: matched.length - recipients.length };
}
export function createAudienceSnapshot(users: Resident[], geometry: GeofenceGeometry | null, filter: AudienceFilter, at: string): AudienceSnapshot {
  const audience = getAudience(users, geometry, filter, at);
  if (!audience.valid || !isAudienceFilter(filter) || !audience.recipients.length) throw new Error('Choose a valid area and at least one eligible recipient.');
  return {
    mode: 'demo', groups: [...new Set(filter.groups)], activeOnly: filter.activeOnly,
    recipientIds: [...new Set(audience.recipients.map(user => user.id))],
    activeCount: audience.recipients.filter(user => locationStatus(user, at) === 'active').length,
    excludedCount: audience.excluded, locationSnapshotAt: at,
  };
}
