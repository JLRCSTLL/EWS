import type { DashboardMessage } from './dashboard-data.ts';
import type { GeofenceGeometry } from './geofencing.ts';
import { getAudience, locationStatus, matchesGroup, residentGroups, type Resident } from './residents.ts';

export function getAlertReach(users: Resident[], geometry: GeofenceGeometry | null, at: string) {
  const audience = getAudience(users, geometry, { groups: ['all'], activeOnly: true }, at);
  return {
    ...audience,
    recentEligible: audience.located.filter(user => user.notificationsEnabled && locationStatus(user, at) === 'recent').length,
    notificationsOff: audience.located.filter(user => !user.notificationsEnabled).length,
    groups: residentGroups.map(group => ({
      ...group,
      eligible: audience.recipients.filter(user => matchesGroup(user, group.id)).length,
    })),
  };
}

export function getAreaBroadcasts(messages: DashboardMessage[], areaId: string | null) {
  return messages
    .filter(message => message.audience?.mode === 'demo' && (!areaId || message.geofence?.id === areaId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
