import type { LiveState, LiveUser } from './live-model.ts';
import type { TeamGroup } from './organization.ts';
import type { AuditLogEntry } from './dashboard-data.ts';
import { emptyEmergencyProfile } from './emergency-profile.ts';

export type PresentationTeam = { group: TeamGroup; members: LiveUser[] };
export function createPresentationState(): LiveState {
  const time = '2026-10-28T01:00:00.000Z';
  const person = (id: string, name: string, onDuty: boolean): LiveUser => ({
    id, name, username: id, role: 'resident', operatorRequested: false, groups: [],
    municipality: '', email: '••••@example.invalid', phone: '•••• ••• 0100', contactVisible: [],
    alertsEnabled: true, locationSharing: onDuty, onDuty, dutyAt: onDuty ? time : null, dutyProjectId: null,
    location: onDuty ? { lat: 14.63, lng: id === 'demo-alex' ? 121.10 : 121.04, accuracy: 12, updatedAt: time } : null,
    safeAt: null, createdAt: time,
  });
  const users = [person('demo-alex','Alex · Demo',true), person('demo-sam','Sam · Demo',true), person('demo-kai','Kai · Demo',false)];
  users[0].emergencyProfile = { ...emptyEmergencyProfile(), ageRange: '60plus', pwdStatus: 'yes', assistanceNeeds: ['mobility','transport'], shareWithOperators: true };
  users[0].groups = ['pwd','seniors'];
  return { user: {...users[0],id:'demo-operator',name:'Demo operator',role:'admin'}, users,
    alerts:[],requests:[],projects:[],teamGroups:[],memberships:[],tasks:[],contactRequests:[],serverTime:time };
}

// Presentation mutations are deliberately in memory: never delegate to the live API.
export function changePresentationGroup(previous: LiveState, path: string, body: Record<string, any>, method: string) {
  const state = structuredClone(previous);
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'groups') throw new Error('Only sample group changes are available in the presentation.');
  if (parts.length === 1 && method === 'POST') {
    const id = `presentation-group-${state.teamGroups.length + 1}`;
    if (!body.name?.trim() || !/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(body.tag || '')) throw new Error('Enter a group name and valid tag.');
    if (state.teamGroups.some(g => g.tag === body.tag)) throw new Error('That demo tag already exists.');
    if (body.headId && !state.users.some(p => p.id === body.headId)) throw new Error('Choose a sample leader.');
    state.teamGroups.push({id,name:body.name.trim(),tag:body.tag,description:String(body.description || ''),head_id:body.headId || null,parent_id:null,project_id:null,archived:false});
    if (body.headId) state.memberships.push({group_id:id,user_id:body.headId,title:'',category:'',is_leader:true});
    return {state,result:{id}};
  }
  const group = state.teamGroups.find(g => g.id === parts[1]);
  if (!group) throw new Error('This sample group is not available. Restart this chapter.');
  if (parts.length === 3 && parts[2] === 'members' && method === 'PUT') {
    for (const id of new Set<string>(body.userIds || [])) {
      if (!state.users.some(p => p.id === id)) throw new Error('Choose sample personnel only.');
      if (!state.memberships.some(m => m.group_id === group.id && m.user_id === id)) state.memberships.push({group_id:group.id,user_id:id,title:'',category:'',is_leader:false});
    }
  } else if (parts.length === 4 && parts[2] === 'members' && method === 'PUT') {
    const member = state.memberships.find(m => m.group_id === group.id && m.user_id === parts[3]);
    if (!member) throw new Error('Sample member not found.');
    member.is_leader = member.user_id === group.head_id || !!body.isLeader;
  } else throw new Error('This action is not part of the automatic presentation.');
  return {state,result:{id:group.id}};
}

export const presentationLogs: AuditLogEntry[] = [
  {id:'tour-log-3',type:'system',action:'Alert preview completed',user:'Demo operator',details:'#flood-response · 3 sample members · no real delivery',createdAt:'2026-10-28T01:03:00.000Z',severity:'info'},
  {id:'tour-log-2',type:'user',action:'Group leaders assigned',user:'Demo operator',details:'Flood response · 2 sample leaders',createdAt:'2026-10-28T01:02:00.000Z',severity:'info'},
  {id:'tour-log-1',type:'config',action:'Geofence saved',user:'Demo operator',details:'Presentation boundary · temporary workspace',createdAt:'2026-10-28T01:01:00.000Z',severity:'info'},
];
