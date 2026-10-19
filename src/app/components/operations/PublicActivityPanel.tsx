import { useState } from 'react';
import { ArrowUpRight, Check, CheckCheck, MapPin, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { isOpenRequest, publicProfiles, requestStatusLabels, updateRequest, type PublicDemoState, type PublicRequest } from '../../lib/public-demo';
import { mutatePublicState } from '../../lib/public-demo-store';

interface Props { state: PublicDemoState; onLocate: (point: { lat: number; lng: number }) => void }
const time = (at: string) => new Date(at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
function RequestCard({ request, onLocate }: { request: PublicRequest; onLocate: Props['onLocate'] }) {
  const [error, setError] = useState('');
  const profile = publicProfiles.find(profile => profile.resident.id === request.residentId);
  const change = (status: PublicRequest['status'], unit?: string) => {
    try { mutatePublicState(current => updateRequest(current, request.id, status, new Date().toISOString(), unit)); setError(''); }
    catch { setError('Could not save the update in this browser.'); }
  };
  return <article className="ops-public-request">
    <div className="ops-card-heading"><strong>{request.type}</strong><span className={`ops-public-status is-${request.status}`}>{requestStatusLabels[request.status]}</span></div>
    <p>{profile?.name || request.residentId} · {profile?.city} · {request.people} {request.people === 1 ? 'person' : 'people'}</p>
    <small>{request.residentId} · {time(request.createdAt)} · Public app demo</small>
    {request.note && <p className="ops-public-note">{request.note}</p>}
    {request.unit && <p>Assigned demo unit: <strong>{request.unit}</strong></p>}
    <div className="ops-public-request-actions">
      <button disabled={!request.location} onClick={() => request.location && onLocate(request.location)}><MapPin size={13} />{request.location ? 'Locate on map' : 'Location not shared'}</button>
      {request.status === 'new' && <button onClick={() => change('acknowledged')}><Check size={13} />Acknowledge</button>}
      {isOpenRequest(request) && request.status !== 'assigned' && <select aria-label={`Assign a demo unit to ${profile?.name}`} value="" onChange={event => change('assigned', event.target.value)}><option value="" disabled>Assign demo unit…</option><option>Ambulance Bravo</option><option>Rescue Alpha</option></select>}
      {isOpenRequest(request) && <button onClick={() => change('resolved')}><CheckCheck size={13} />Resolve</button>}
    </div>{error && <p role="alert">{error}</p>}
  </article>;
}
export function PublicActivityPanel({ state, onLocate }: Props) {
  const [showAll, setShowAll] = useState(false);
  const pending = state.requests.filter(isOpenRequest);
  const requests = showAll ? state.requests : pending;
  return <div className="ops-public-inbox">
    <div className="ops-public-intro"><Smartphone size={23} /><div><strong>Connected public demo</strong><p>Check-ins, requests and acknowledgments sync with the public app in this browser. No real emergency dispatch.</p></div><a href="#/public" target="_blank" rel="noreferrer">Open public app<ArrowUpRight size={14} /></a></div>
    <div className="ops-public-summary"><span><strong>{pending.length}</strong>Open requests</span><span><strong>{state.checkIns.length}</strong>Safe check-ins</span><span><strong>{state.acknowledgments.length}</strong>Alerts acknowledged</span></div>
    <div className="ops-public-section-heading"><h3>Assistance requests</h3><button onClick={() => setShowAll(value => !value)}>{showAll ? 'Open only' : 'Include closed'}</button></div>
    <div className="ops-public-requests">{requests.map(request => <RequestCard key={request.id} request={request} onLocate={onLocate} />)}{!requests.length && <div className="ops-public-empty"><Users size={24} /><strong>No {showAll ? '' : 'open '}requests</strong><p>Open the public app and choose Request help to demonstrate the connection.</p></div>}</div>
    <h3>Resident check-ins</h3>
    <div className="ops-public-checkins">{state.checkIns.map(item => { const profile = publicProfiles.find(profile => profile.resident.id === item.residentId); return <div key={item.residentId}><ShieldCheck size={20} /><span><strong>{profile?.name}</strong><small>Reported safe · {time(item.at)} · {profile?.city}</small></span><button disabled={!item.location} onClick={() => item.location && onLocate(item.location)}><MapPin size={13} />{item.location ? 'Locate' : 'No location'}</button></div>; })}{!state.checkIns.length && <p className="ops-public-empty-copy">“I’m safe” updates from the public app will appear here.</p>}</div>
    <details className="ops-public-acknowledgments"><summary>Alert acknowledgments ({state.acknowledgments.length})</summary>{state.acknowledgments.map(item => <p key={item.residentId + item.messageId}><CheckCheck size={13} />{publicProfiles.find(profile => profile.resident.id === item.residentId)?.name} · {time(item.at)}<small>{item.messageId}</small></p>)}</details>
  </div>;
}
