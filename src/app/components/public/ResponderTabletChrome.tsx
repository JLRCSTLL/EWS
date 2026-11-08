import { useState } from 'react';
import { Ambulance, Bell, ClipboardList, Home, Hospital, Map, MessageCircle, Search, UserRound, X, Radio, Check, Navigation } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { responseLabels, responseTransitions, type ResponseIncident, type ResponseStatus } from '../../lib/response';

type View = 'navigation' | 'chat' | 'details';
export function ResponderTabletChrome({ incident, incidents, view, onView, onSelect, onHospitals, connected, name, onDuty, now }: {
  incident?: ResponseIncident; incidents: ResponseIncident[]; view: View; onView: (view: View) => void;
  onSelect: (id: string) => void; onHospitals: () => void; connected: boolean; name: string; onDuty: boolean; now: number;
}) {
  const [query, setQuery] = useState('');
  const matches = incidents.filter(row => `${row.title} ${row.unit} ${row.location.label} ${row.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <header className="rsp-tablet-header rsp-glass" data-map-occlusion="top">
      <a href="#/public" className="rsp-tablet-logo"><BrandLogo compact caption="Responder" /></a>
      <div className="rsp-tablet-connection" role="status"><i className={connected ? 'is-connected' : ''}/><span>{connected ? 'Connected' : 'Reconnecting'}<small>Live dispatch service</small></span></div>
      <time dateTime={new Date(now).toISOString()}>{new Date(now).toLocaleTimeString('en-PH', {hour:'numeric', minute:'2-digit'})}<small>{new Date(now).toLocaleDateString('en-PH', {weekday:'short', month:'short', day:'numeric'})}</small></time>
      <div className="rsp-assignment-search">
        <label><Search size={18}/><input type="search" aria-label="Search your assignments" placeholder="Search assignment, location or unit…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if(e.key === 'Escape') setQuery(''); }}/></label>
        {query.trim() && <div className="rsp-assignment-results rsp-glass"><div><small>{matches.length} matching assignments</small><button onClick={() => setQuery('')} aria-label="Close assignment search"><X size={16}/></button></div>{matches.slice(0,15).map(row => <button key={row.id} onClick={() => { onSelect(row.id); setQuery(''); }}><strong>{row.title}</strong><span>{row.location.label}</span><small>{row.unit || 'Assigned response'} · {responseLabels[row.status]}</small></button>)}{!matches.length && <p>No matching assignments. Search by incident, location or unit.</p>}</div>}
      </div>
    </header>
    <aside className="rsp-tablet-rail rsp-glass">
      <nav aria-label="Responder workspace">
        <a href="#/public"><Home size={20}/>Home</a>
        {incident && <><button className={view === 'details' ? 'is-active' : ''} onClick={() => onView('details')}><ClipboardList size={20}/>Assignment</button><button className={view === 'navigation' ? 'is-active' : ''} onClick={() => onView('navigation')}><Map size={20}/>Navigation</button><button className={view === 'chat' ? 'is-active' : ''} onClick={() => onView('chat')}><MessageCircle size={20}/>Messages</button><button onClick={onHospitals}><Hospital size={20}/>Hospitals</button></>}
        <a href="#/public/alerts"><Bell size={20}/>Alerts</a>
      </nav>
      <div className="rsp-tablet-identity"><Ambulance size={24}/><span><strong>{incident?.unit || 'Field responder'}</strong><small>{onDuty ? 'On duty' : 'Off duty'}</small></span></div>
      <a className="rsp-tablet-account" href="#/public/account"><UserRound size={22}/><span><strong>{name}</strong><small>My account</small></span></a>
    </aside>
  </>;
}

const steps: [ResponseStatus, string][] = [['en_route','En route'],['on_scene','On scene'],['to_hospital','Transporting'],['at_hospital','At hospital'],['returning','Returning'],['completed','Back at base']];
export function ResponderTabletStatus({incident, busy, connected, onChange}: {incident: ResponseIncident; busy: boolean; connected: boolean; onChange: (status: ResponseStatus) => void}) {
  const next = responseTransitions[incident.status] || [];
  return <section className="rsp-tablet-status rsp-glass" data-map-occlusion="bottom" aria-label="Update response status"><div><Radio size={22}/><span><strong>Update status</strong><small>Keep dispatch informed</small></span></div><div className="rsp-tablet-status-steps">{steps.map(([status, label]) => <button key={status} className={incident.status === status ? 'is-current' : ''} aria-current={incident.status === status ? 'step' : undefined} disabled={busy || !connected || !next.includes(status)} onClick={() => onChange(status)} title={next.includes(status) ? `Confirm ${label.toLowerCase()}` : incident.status === status ? 'Current status' : 'Available when the previous stage is complete'}>{status === 'completed' ? <Check size={18}/> : status === 'to_hospital' || status === 'at_hospital' ? <Hospital size={18}/> : <Navigation size={18}/>}<span>{label}</span></button>)}</div></section>;
}
