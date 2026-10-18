import { useMemo, useState } from 'react';
import { ArrowUpRight, Crosshair, Send, Users } from 'lucide-react';
import { messageTemplates, type MessagePriority } from '../../lib/dashboard-data';
import { isAlertGeofence, type AlertGeofence } from '../../lib/geofencing';
import { audienceLabel, demoResidents, demoSnapshotAt, getAudience, locationAgeMinutes, locationStatus, residentGroups, type AudienceFilter, type AudienceGroup } from '../../lib/residents';
import type { OutboundMessageDraft } from '../MessagingPanel';
import { ExposureMap } from './ExposureMap';

interface Props {
  areas: AlertGeofence[];
  selectedId: string | null;
  initialGroup: AudienceGroup;
  initialActiveOnly?: boolean;
  onSelectArea: (id: string | null) => void;
  onSendMessage: (draft: OutboundMessageDraft) => void;
  onHistory: () => void;
  presentationMode?: boolean;
}

export function AudienceBroadcastPanel({ areas, selectedId, initialGroup, initialActiveOnly = true, onSelectArea, onSendMessage, onHistory, presentationMode = false }: Props) {
  const [filter, setFilter] = useState<AudienceFilter>({ groups: [initialGroup], activeOnly: initialActiveOnly });
  const [message, setMessage] = useState('');
  const [presented, setPresented] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('high');
  const [focusId, setFocusId] = useState<string | null>(null);
  const area = areas.find(item => item.id === selectedId) || null;
  const invalidArea = !!selectedId && !isAlertGeofence(area);
  const audience = useMemo(() => getAudience(demoResidents, area, filter, demoSnapshotAt), [area, filter]);
  const template = messageTemplates.find(item => item.id === templateId);
  const toggleGroup = (group: AudienceGroup) => {
    setFocusId(null);
    setFilter(current => ({ ...current, groups: group === 'all' ? current.groups.includes('all') ? [] : ['all'] : current.groups.includes(group)
      ? current.groups.filter(item => item !== group) : [...current.groups.filter(item => item !== 'all'), group] }));
  };
  const send = () => {
    if (!message.trim() || !audience.recipients.length || invalidArea) return;
    if (presentationMode) { setPresented(true); return; }
    onSendMessage({ content: message.trim(), category: template?.category || 'Community Alert', priority,
      targetGroupId: 'app-users', geoFenceId: area ? 'map-area' : 'all-areas', geofence: area || undefined,
      templateLabel: template?.label, appAudience: filter });
    setMessage('');
    onHistory();
  };
  return <div className="ops-audience-composer">
    <section className="ops-audience-targeting" aria-label="Audience targeting">
      <div className="ops-audience-heading"><span className="ops-step">01</span><h3>Choose your audience</h3><Users size={16} /></div>
      <label className="ops-form-label">Geographic area<select aria-label="Broadcast geographic area" value={selectedId || 'all-areas'} onChange={event => { setFocusId(null); onSelectArea(event.target.value === 'all-areas' ? null : event.target.value); }}>
        <option value="all-areas">All demo app users with a location</option>
        {areas.map(item => <option key={item.id} value={item.id}>{item.name || 'Unnamed area'}</option>)}
      </select></label>
      <fieldset className="ops-audience-groups"><legend>Recipient groups <span>Match any selected group</span></legend>
        <label><input type="checkbox" checked={filter.groups.includes('all')} onChange={() => toggleGroup('all')} /><span>All app users</span><strong>{audience.total}</strong></label>
        {residentGroups.map(group => <label key={group.id} title={group.description}><input data-demo={`group-${group.id}`} type="checkbox" checked={filter.groups.includes(group.id)} onChange={() => toggleGroup(group.id)} /><span>{group.label}</span><strong>{audience.counts[group.id]}</strong></label>)}
      </fieldset>
      <label className="ops-active-filter"><input type="checkbox" checked={filter.activeOnly} onChange={event => { setFocusId(null); setFilter(current => ({ ...current, activeOnly: event.target.checked })); }} /><span>Active users only<small>Location shared within 5 minutes of snapshot</small></span></label>
      <p className="ops-audience-help">{filter.activeOnly ? 'Only active locations are eligible.' : 'Active and recent locations (up to 60 min) are eligible.'} Stale locations and disabled notifications are excluded. Each person receives one message, even if groups overlap.</p>
      <div className="ops-recipient-summary" aria-live="polite"><strong>{invalidArea ? '—' : audience.recipients.length}</strong><span>eligible recipients<small>{audience.matched.length} match groups · {audience.excluded} excluded</small></span><ArrowUpRight size={18} /></div>
      <p className="ops-audience-help">{audience.unavailable} demo users have no shared location and cannot be placed inside an area.</p>
      {invalidArea && <p className="ops-audience-error" role="alert">Save a valid, named area before sending.</p>}
      {!filter.groups.length && <p className="ops-audience-error" role="status">Select at least one recipient group.</p>}
      {!!filter.groups.length && !audience.recipients.length && <p className="ops-audience-error" role="status">No eligible recipients. Choose another area or group, or include recent locations.</p>}
    </section>
    <section className="ops-audience-visibility" aria-label="Exposure visibility">
      <div className="ops-audience-heading"><span className="ops-step">02</span><h3>Review exposure &amp; locations</h3><Crosshair size={16} /></div>
      <p className="ops-snapshot-label">Fictional location snapshot · {new Date(demoSnapshotAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })} PHT</p>
      <ExposureMap geofence={area} located={audience.located} recipients={audience.recipients} focusId={focusId} />
      <div className="ops-resident-legend"><span><i className="is-active" />Active ≤5 min</span><span><i className="is-recent" />Recent ≤60 min</span><span><i />Excluded / stale</span></div>
      <div className="ops-recipient-list-heading"><h4>Recipient preview</h4><span>{audience.recipients.length} unique people</span></div>
      <div className="ops-recipient-list" tabIndex={0} aria-label="Eligible recipients and last shared locations">
        {audience.recipients.map(user => <button key={user.id} aria-label={`Locate ${user.name}`} onClick={() => setFocusId(user.id)} className={focusId === user.id ? 'is-selected' : ''}>
          <span className={`ops-resident-state is-${locationStatus(user, demoSnapshotAt)}`} /><span><strong>{user.name}</strong><small>{user.location?.lat.toFixed(5)}, {user.location?.lng.toFixed(5)} · ±{user.location?.accuracy} m</small></span><span>{Math.round(locationAgeMinutes(user, demoSnapshotAt))} min ago<Crosshair size={13} /></span>
        </button>)}
        {!audience.recipients.length && <p className="ops-empty">No recipients in this selection.</p>}
      </div>
      <p className="ops-audience-help">Select a person to inspect their last shared position. Times are relative to this demo snapshot; locations are not a live feed.</p>
    </section>
    <section className="ops-audience-message" aria-label="Write an alert">
      <div className="ops-audience-heading"><span className="ops-step">03</span><h3>Write the alert</h3></div>
      <div className="ops-compose-options"><label className="ops-form-label">Template<select aria-label="Alert template" value={templateId} onChange={event => {
        const next = messageTemplates.find(item => item.id === event.target.value);
        setTemplateId(event.target.value);
        if (next) { setMessage(next.content.slice(0, 500)); setPriority(next.category === 'Evacuation' || next.category === 'Medical Alert' ? 'critical' : 'high'); }
      }}><option value="">Custom message</option>{messageTemplates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="ops-form-label">Priority<select aria-label="Alert priority" value={priority} onChange={event => setPriority(event.target.value as MessagePriority)}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
      <label className="ops-form-label">Message<textarea aria-label="Alert message" value={message} maxLength={500} onChange={event => setMessage(event.target.value)} placeholder="Describe the emergency, where to go, and what residents should do." rows={4} /></label>
      <div className="ops-message-limit">{message.length} / 500</div>
      <div className="ops-send-scope"><strong>{audienceLabel(filter) || 'No group selected'}</strong><span>{area?.name || 'All demo app users'} · {filter.activeOnly ? 'active locations' : 'locations up to 60 min old'}</span></div>
      <button className="ops-send-demo" disabled={!message.trim() || !audience.recipients.length || invalidArea} onClick={send}><Send size={15} />{presentationMode ? `Simulate alert to ${audience.recipients.length} users` : `Send demo alert to ${audience.recipients.length} users`}</button>
      <p className="ops-audience-help">{presentationMode ? 'Presentation preview. No messages are sent or saved to history.' : 'Simulated delivery. Recipient IDs and the boundary are saved to history.'}</p>
      {presentationMode && presented && <div className="ops-tour-delivery" role="status"><strong>Demo delivery preview · {audience.recipients.length} recipients</strong><p>{message}</p><small>{audienceLabel(filter)} · {area?.name} · {priority} priority</small><small>Presentation only — no real notification sent.</small></div>}
    </section>
  </div>;
}
