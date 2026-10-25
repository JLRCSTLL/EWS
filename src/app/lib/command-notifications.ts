export interface CommandNotification { id:string; title:string; detail:string; at:string; destination:'public'|'broadcast'; kind:'request'|'safe'|'broadcast' }
/** Only actual connected records populate the desktop notification bell. */
export function commandNotifications(state: Pick<LiveState,'users'|'requests'|'alerts'> | null): CommandNotification[] {
  if (!state) return [];
  return [
    ...state.requests.map(r => ({id:`request:${r.id}:${r.status}`,title:`${r.name || 'Personnel'} · ${r.type || 'Assistance request'}`,detail:r.status === 'new' ? 'New field request · awaiting response' : r.status === 'assigned' ? `Assigned${r.assigned_unit ? ` to ${r.assigned_unit}` : ''}` : r.status === 'resolved' ? 'Request resolved' : 'Request acknowledged',at:r.updated_at || r.created_at,destination:'public' as const,kind:'request' as const})),
    ...state.users.filter(u => u.safeAt).map(u => ({id:`safe:${u.id}:${u.safeAt}`,title:`${u.name} checked in safe`,detail:'View the latest field check-in.',at:u.safeAt,destination:'public' as const,kind:'safe' as const})),
    ...state.alerts.map(a => ({id:`broadcast:${a.id}`,title:`${a.priority === 'critical' ? 'Critical' : a.priority === 'high' ? 'High priority' : 'New'} broadcast`,detail:a.content,at:a.created_at,destination:'broadcast' as const,kind:'broadcast' as const})),
  ].filter(item => Number.isFinite(Date.parse(item.at))).sort((a,b) => Date.parse(b.at)-Date.parse(a.at)).slice(0,50);
}
import type { LiveState } from './live-model';
