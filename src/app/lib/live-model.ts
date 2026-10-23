import type { Resident } from './residents.ts';
import type { AlertGeofence } from './geofencing.ts';
import type { TeamGroup, GroupMember, Project, ProjectTask, ContactRequest } from './organization.ts';

export interface LiveUser {
  id: string; username: string; name: string; role: 'resident' | 'operator' | 'admin';
  operatorRequested: boolean; groups: string[]; municipality: string; alertsEnabled: boolean;
  locationSharing: boolean; location: { lat: number; lng: number; accuracy: number; updatedAt: string } | null;
  safeAt: string | null; createdAt: string;
  onDuty: boolean; dutyAt: string | null; dutyProjectId: string | null;
  email: string; phone: string; contactVisible: string[];
}
export interface LiveAlert {
  id: string; content: string; priority: 'normal' | 'high' | 'critical'; area: AlertGeofence | null;
  target_mode?: 'geofence' | 'groups'; target_label?: string; target_group_ids?: string[];
  groups: string[]; recipient_count: number; created_at: string;
  received_count: number; read_count: number; received_at?: string | null; read_at?: string | null;
}
export interface LiveRequest {
  id: string; user_id: string; name: string; type: string; note: string; people: number;
  include_location: boolean; status: 'new' | 'acknowledged' | 'assigned' | 'resolved' | 'cancelled';
  assigned_unit: string; created_at: string; updated_at: string;
}
export interface LiveState { user: LiveUser; users: LiveUser[]; alerts: LiveAlert[]; requests: LiveRequest[]; serverTime: string;
  projects: Project[]; teamGroups: TeamGroup[]; memberships: GroupMember[]; tasks: ProjectTask[]; contactRequests: ContactRequest[];
}
export const alertLabel = (alert: LiveAlert) => alert.target_label || alert.area?.name || 'Group alert';
export const openRequest = (request: LiveRequest) => ['new', 'acknowledged', 'assigned'].includes(request.status);
export const asResident = (user: LiveUser): Resident => ({
  id: user.id, name: user.name, age: user.groups.includes('children') ? 12 : user.groups.includes('seniors') ? 65 : 30,
  pwd: user.groups.includes('pwd'), pregnant: user.groups.includes('pregnant'), responder: user.groups.includes('responders'),
  notificationsEnabled: user.alertsEnabled, location: user.locationSharing ? user.location : null,
});
