import type { DashboardMessage } from './dashboard-data';
import { demoGeofences, demoResidents, demoSnapshotAt, getAudience, type Resident } from './residents.ts';

export const PUBLIC_DEMO_KEY = 'e-ligtas-public-demo-v1';
export const COMMAND_MESSAGES_KEY = 'ecc-dashboard-messages';
export const PUBLIC_DEMO_EVENT = 'e-ligtas-demo-update';
export const publicProfiles = [
  { areaId: 'demo-marikina', city: 'Marikina City', name: 'Juan Dela Cruz', initials: 'JC' },
  { areaId: 'demo-manila', city: 'Manila', name: 'Ana Reyes', initials: 'AR' },
  { areaId: 'demo-qc', city: 'Quezon City', name: 'Mika Santos', initials: 'MS' },
].map(profile => {
  const area = demoGeofences.find(area => area.id === profile.areaId)!;
  const eligible = getAudience(demoResidents, area, { groups: ['all'], activeOnly: true }, demoSnapshotAt).recipients;
  return { ...profile, resident: eligible.find(user => user.pwd) || eligible[0] };
});

export type RequestStatus = 'new' | 'acknowledged' | 'assigned' | 'resolved' | 'cancelled';
export type HelpType = 'Evacuation' | 'Medical assistance' | 'Rescue' | 'Other assistance';
export interface PublicRequest {
  id: string; residentId: string; type: HelpType; note: string; people: number;
  location: { lat: number; lng: number } | null;
  status: RequestStatus; unit?: string; createdAt: string; updatedAt: string;
}
export interface PublicCheckIn { residentId: string; at: string; location: { lat: number; lng: number } | null }
export interface PublicAcknowledgment { residentId: string; messageId: string; at: string }
export interface PublicPreferences { residentId: string; shareLocation: boolean }
export interface PublicDemoState {
  requests: PublicRequest[]; checkIns: PublicCheckIn[]; acknowledgments: PublicAcknowledgment[]; preferences: PublicPreferences[];
}
export const emptyPublicState: PublicDemoState = { requests: [], checkIns: [], acknowledgments: [], preferences: [] };
export const requestStatusLabels: Record<RequestStatus, string> = { new: 'Awaiting demo operator', acknowledged: 'Acknowledged', assigned: 'Demo unit assigned', resolved: 'Resolved', cancelled: 'Cancelled' };
const statuses: RequestStatus[] = ['new', 'acknowledged', 'assigned', 'resolved', 'cancelled'];
const helpTypes: HelpType[] = ['Evacuation', 'Medical assistance', 'Rescue', 'Other assistance'];
const validId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length < 160;
const validResident = (value: unknown) => publicProfiles.some(profile => profile.resident.id === value);
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validLocation = (value: any) => value === null || (value && Number.isFinite(value.lat) && Math.abs(value.lat) <= 85 && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180);

export function parsePublicState(raw: string | null): PublicDemoState {
  try {
    const data = JSON.parse(raw || '{}');
    if (!data || typeof data !== 'object') return emptyPublicState;
    return {
      requests: Array.isArray(data.requests) ? data.requests.filter((item: any) => item && validId(item.id) && validResident(item.residentId) && helpTypes.includes(item.type) && typeof item.note === 'string' && item.note.length <= 300 && Number.isInteger(item.people) && item.people >= 1 && item.people <= 20 && statuses.includes(item.status) && validDate(item.createdAt) && validDate(item.updatedAt) && validLocation(item.location) && (item.unit === undefined || ['Ambulance Bravo', 'Rescue Alpha'].includes(item.unit))).slice(0, 100) : [],
      checkIns: Array.isArray(data.checkIns) ? data.checkIns.filter((item: any) => item && validResident(item.residentId) && validDate(item.at) && validLocation(item.location)).slice(0, 100) : [],
      acknowledgments: Array.isArray(data.acknowledgments) ? data.acknowledgments.filter((item: any) => item && validResident(item.residentId) && validId(item.messageId) && validDate(item.at)).slice(0, 200) : [],
      preferences: Array.isArray(data.preferences) ? data.preferences.filter((item: any) => item && validResident(item.residentId) && typeof item.shareLocation === 'boolean').slice(0, 3) : [],
    };
  } catch { return emptyPublicState; }
}
export function isOpenRequest(request: PublicRequest) { return ['new', 'acknowledged', 'assigned'].includes(request.status); }
export function publicInbox(messages: DashboardMessage[], residentId: string) {
  return messages.filter(message => message && typeof message.id === 'string' && typeof message.content === 'string' && message.status === 'delivered'
    && message.audience?.mode === 'demo' && Array.isArray(message.audience.recipientIds) && message.audience.recipientIds.includes(residentId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function acknowledgeAlert(state: PublicDemoState, residentId: string, messageId: string, at: string): PublicDemoState {
  return { ...state, acknowledgments: [{ residentId, messageId, at }, ...state.acknowledgments.filter(item => item.residentId !== residentId || item.messageId !== messageId)].slice(0, 200) };
}
export function checkInSafe(state: PublicDemoState, resident: Resident, shareLocation: boolean, at: string): PublicDemoState {
  return { ...state, checkIns: [{ residentId: resident.id, at, location: shareLocation && resident.location ? { lat: resident.location.lat, lng: resident.location.lng } : null }, ...state.checkIns.filter(item => item.residentId !== resident.id)] };
}
export function updateRequest(state: PublicDemoState, id: string, status: RequestStatus, at: string, unit?: string): PublicDemoState {
  return { ...state, requests: state.requests.map(request => {
    if (request.id !== id || !isOpenRequest(request)) return request;
    if (status === 'new' || (status === 'acknowledged' && request.status !== 'new')) return request;
    if (status === 'assigned' && !['Ambulance Bravo', 'Rescue Alpha'].includes(unit || '')) return request;
    return { ...request, status, updatedAt: at, unit: status === 'assigned' ? unit : request.unit };
  }) };
}
export function addRequest(state: PublicDemoState, request: PublicRequest): PublicDemoState {
  if (state.requests.some(item => item.residentId === request.residentId && isOpenRequest(item))) return state;
  return { ...state, requests: [request, ...state.requests].slice(0, 100) };
}
export const demoPlaces = [
  { id: 'hub', name: 'Community evacuation hub', type: 'Evacuation center', lat: 14.661, lng: 121.108, detail: 'Sample facility · 80 available spaces', accessible: true },
  { id: 'hall', name: 'City sports hall', type: 'Evacuation center', lat: 14.643, lng: 121.101, detail: 'Sample facility · 120 available spaces', accessible: true },
  { id: 'clinic', name: 'Community health station', type: 'Medical support', lat: 14.651, lng: 121.12, detail: 'Sample facility · medical support point', accessible: true },
];
