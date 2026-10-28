import { useState } from 'react';
import { ArrowUpRight, CheckCheck, LocateFixed, Radio, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { useLive } from '../../lib/live-service';
import { asResident, openRequest, alertLabel } from '../../lib/live-model';
import { getAudience, getExposure, type AudienceGroup } from '../../lib/residents';
import type { AlertGeofence, GeofenceGeometry, GeofencePoint } from '../../lib/geofencing';
import { AuthPanel } from '../public/AuthPanel';
import { GroupBroadcastComposer } from './GroupBroadcastComposer';
import { PersonnelDirectory } from './StructureWorkspace';
import { memberIds } from '../../lib/organization';
import '../../../styles/live-app.css';
import '../../../styles/connected-operations.css';

const stamp = (date: string) => new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function ConnectedOperations({ tab = 'people', areas = [], selectedId, onSelectArea, initialGroup = 'all', initialActiveOnly = true, onLocate, onShowLocations, locationsVisible = true, initialTeamGroupId }: {
  tab?: 'people' | 'inbox' | 'compose' | 'history'; areas?: AlertGeofence[]; selectedId?: string | null;
  onSelectArea?: (id: string) => void; initialGroup?: AudienceGroup; initialActiveOnly?: boolean; onLocate?: (point: GeofencePoint) => void;
  onShowLocations?: () => void; locationsVisible?: boolean; initialTeamGroupId?: string;
}) {
  const live = useLive();
  const { state, connection, recoveryCode } = live;
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState(''), [setup, setSetup] = useState(false);
  const operator = state && ['operator','admin'].includes(state.user.role);
  const sharedLocations = operator ? getExposure(state.users.map(asResident), null, state.serverTime).total : 0;
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); if (message) setNotice(message); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to complete this action.'); }
    finally { setBusy(false); }
  }
  return <div className="el-connected">
    <div className="el-connected-intro"><Smartphone size={24} /><div><strong>Connected personnel</strong><p>Accounts, alerts, and shared locations sync through the shared service.</p></div><span className={connection === 'connected' ? 'is-online' : ''}>{connection === 'connected' ? 'Service connected' : 'Service unavailable'}</span></div>
    {connection !== 'connected' && <p className="el-connected-notice">{live.error || 'Connecting to the service…'}<button onClick={() => void live.refresh()}>Retry</button></p>}
    {error && <p className="el-connected-error" role="alert">{error}</p>}{notice && <p className="el-connected-notice" role="status">{notice}</p>}
    {!state || recoveryCode ? <AuthPanel commandCenter /> : !operator ? <section className="el-access-pending"><ShieldCheck size={30} /><h3>Welcome, {state.user.name}</h3><p>Your personnel account is ready. An approved operator or the account owner must grant command-center access before you can view shared locations or send alerts.</p><button disabled={busy || state.user.operatorRequested} onClick={() => void run(() => live.mutate('/operator/request',{}),'Your operator access request is pending approval.')}>{state.user.operatorRequested ? 'Operator approval pending' : 'Request operator access'}</button><a href="#/public">Open personnel app <ArrowUpRight size={14} /></a><button className="el-connected-text" onClick={() => setSetup(value => !value)}>Account owner setup</button>{setup && <form onSubmit={e => { e.preventDefault(); const token = new FormData(e.currentTarget).get('token'); void run(() => live.mutate('/operator/bootstrap',{ token }),'Owner account activated.'); }}><label>Owner setup key<input name="token" type="password" autoComplete="off" required /></label><p>Use the BOOTSTRAP_TOKEN from your Render service’s environment. This one-time step activates the first owner; it is unavailable after setup.</p><button disabled={busy}>Activate owner account</button></form>}</section> : <>
      {tab === 'compose' && <GroupBroadcastComposer areas={areas} selectedId={selectedId} onSelectArea={onSelectArea} initialTeamGroupId={initialTeamGroupId} initialGroup={initialGroup} initialActiveOnly={initialActiveOnly} onLocate={onLocate} />}
      {tab === 'history' && <div className="el-live-history">{state.alerts.length ? state.alerts.map(alert => <article key={alert.id}><div><strong>{alertLabel(alert)}</strong><time>{stamp(alert.created_at)}</time></div><p>{alert.content}</p><dl><div><dt>Targeted</dt><dd>{alert.recipient_count}</dd></div><div><dt>Received by app</dt><dd>{alert.received_count}</dd></div><div><dt>Read</dt><dd>{alert.read_count}</dd></div></dl></article>) : <p>No connected broadcasts yet. Choose named groups or a geofence audience to send an alert.</p>}</div>}
      {(tab === 'people' || tab === 'inbox') && <>
        {tab === 'people' && <section className="el-connected-locations" aria-label="Shared phone locations">
          <Smartphone size={18} />
          <div role="status"><strong>{sharedLocations ? `${sharedLocations} shared ${sharedLocations === 1 ? 'location' : 'locations'}${locationsVisible ? '' : ' · layer hidden'}` : 'No phone locations received yet'}</strong><small>{connection !== 'connected' ? 'Connection interrupted · showing the last saved update' : sharedLocations ? 'On-duty personnel, including outside the selected geofence' : 'Open the mobile app and start duty'}</small></div>
          <button type="button" disabled={!sharedLocations || !onShowLocations} onClick={onShowLocations}>Show shared locations<LocateFixed size={15} /></button>
        </section>}
        <div className="el-connected-stats"><span><strong>{state.users.length}</strong>Registered accounts</span><span><strong>{state.users.filter(u => u.locationSharing && u.location).length}</strong>Shared locations</span><span><strong>{state.requests.filter(openRequest).length}</strong>Open requests</span></div>
        {tab === 'people' && <PersonnelDirectory onLocate={onLocate} />}
        {tab === 'inbox' && <><h3>Assistance requests</h3><label>Response team to assign<input value={unit} onChange={e => setUnit(e.target.value)} maxLength={80} placeholder="e.g. Rescue Team 1" /></label>{state.requests.map(request => <article className="el-live-request" key={request.id}><header><strong>{request.name} · {request.type}</strong><span>{request.status}</span></header><p>{request.note || 'No extra details supplied.'}</p><small>{request.people} people · {stamp(request.created_at)}{request.assigned_unit && ` · Assigned: ${request.assigned_unit}`}</small>{openRequest(request) && <div>{request.status === 'new' && <button disabled={busy} onClick={() => void run(() => live.mutate(`/requests/${request.id}`,{ status:'acknowledged' },'PATCH'),'Request acknowledged.')}>Acknowledge</button>}<button disabled={busy || !unit.trim()} onClick={() => void run(() => live.mutate(`/requests/${request.id}`,{ status:'assigned',unit },'PATCH'),'Team assigned. The person can see this update.')}>Assign team</button>{request.status !== 'new' && <button disabled={busy} onClick={() => void run(() => live.mutate(`/requests/${request.id}`,{ status:'resolved' },'PATCH'),'Request resolved.')}>Resolve</button>}<button disabled={!request.include_location || !state.users.find(u => u.id === request.user_id)?.location} onClick={() => { const location = state.users.find(u => u.id === request.user_id)?.location; if (location) onLocate?.(location); }}>Locate</button></div>}</article>)}{!state.requests.length && <p className="el-connected-caption">No requests received yet.</p>}<h3>Safe check-ins</h3>{state.users.filter(u => u.safeAt).map(user => <div className="el-approval-row" key={user.id}><CheckCheck size={18} /><span>{user.name}<small>{stamp(user.safeAt!)}</small></span><button disabled={!user.location} onClick={() => user.location && onLocate?.(user.location)}>Locate</button></div>)}</>}
      </>}
    </>}
    {state && <div className="el-connected-footer"><span>Signed in as @{state.user.username}</span><button disabled={busy} onClick={() => void run(live.logout,'Signed out.')}>Sign out</button></div>}
  </div>;
}

export function ConnectedSidebar({ area, draft, onChooseArea, onBroadcast, onPeople, onInbox, onGroups, onGroupBroadcast }: { area: AlertGeofence | null; draft: GeofenceGeometry | null; onChooseArea: () => void; onBroadcast: (group?: AudienceGroup) => void; onPeople: () => void; onInbox: () => void; onGroups?: () => void; onGroupBroadcast?: (id:string)=>void }) {
  const { state, connection } = useLive();
  const operator = state && ['operator','admin'].includes(state.user.role);
  const users = operator ? state.users.map(asResident) : [];
  const audience = getAudience(users,draft || area,{groups:['all'],activeOnly:true},state?.serverTime || new Date().toISOString());
  const groups=state?.teamGroups?.filter(g=>!g.archived)||[],members=state?.memberships||[];
  const duty=operator?state.users.filter(u=>u.onDuty):[];
  return <aside className="ops-sidebar ops-command-sidebar"><div className="ops-sidebar-heading"><span>ONSITE OPERATIONS</span><span className="ops-demo-badge">{connection==='connected'?'Live service':'Offline'}</span></div><button className="ops-command-scope" onClick={onChooseArea}><LocateFixed size={15}/><span><small>SELECTED GEOFENCE</small><strong>{draft?'Drawing boundary':area?.name||'Choose an area'}</strong></span><ArrowUpRight size={14}/></button>
    <section className="ops-glass ops-command-card"><div className="ops-card-heading"><h2><Smartphone size={14}/>Personnel on duty</h2></div><div className="ops-reach-metric"><strong>{operator?duty.length:'—'}</strong><span>on duty<small>{duty.filter(u=>u.location).length} locations · {duty.filter(u=>!u.location).length} awaiting GPS</small></span></div><button className="ops-command-link" onClick={onPeople}>Personnel &amp; privacy<ArrowUpRight size={14}/></button></section>
    <section className="ops-glass ops-command-card"><div className="ops-card-heading"><h2><Users size={14}/>Group directory</h2></div><div className="ops-quick-audience-grid">{groups.slice(0,6).map(group=><button key={group.id} disabled={!operator} onClick={()=>onGroupBroadcast?.(group.id)}><span>#{group.tag}</span><strong>{memberIds(groups,members,[group.id]).size}</strong></button>)}</div>{!groups.length&&<p className="ops-command-note">Create a group and add registered personnel.</p>}<p className="ops-command-note">Group alerts reach members anywhere, including off duty.</p><button className="ops-command-link" onClick={onGroups}>Manage groups<ArrowUpRight size={14}/></button></section>
    <button className="ops-broadcast-button" onClick={()=>onBroadcast('all')}><Radio size={20}/><span><strong>Compose alert</strong><small>Geofence or named groups</small></span></button></aside>;
}
