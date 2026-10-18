import { useMemo } from 'react';
import { Accessibility, ArrowUpRight, Baby, BellOff, ChevronRight, Clock3, Heart, History, MapPin, Radio, ShieldCheck, Users } from 'lucide-react';
import type { DashboardMessage } from '../../lib/dashboard-data';
import type { AlertGeofence, GeofenceGeometry } from '../../lib/geofencing';
import { getGeofenceError } from '../../lib/geofencing';
import { getAlertReach, getAreaBroadcasts } from '../../lib/command-summary';
import { formatRelativeTime } from '../../lib/formatting';
import { audienceLabel, demoResidents, demoSnapshotAt, type AudienceGroup } from '../../lib/residents';

interface Props {
  saved: AlertGeofence | null;
  draft: GeofenceGeometry | null;
  messages: DashboardMessage[];
  onChooseArea: () => void;
  onReview: (group: AudienceGroup, activeOnly?: boolean) => void;
  onHistory: () => void;
}

const groupIcons = { pwd: Accessibility, children: Baby, seniors: Users, pregnant: Heart, responders: ShieldCheck };

export function CommandSidebar({ saved, draft, messages, onChooseArea, onReview, onHistory }: Props) {
  const geometry = draft || saved;
  const reach = useMemo(() => getAlertReach(demoResidents, geometry, demoSnapshotAt), [geometry]);
  const broadcasts = useMemo(() => getAreaBroadcasts(messages, saved?.id || null), [messages, saved?.id]);
  const latest = draft ? undefined : broadcasts[0];
  const eligible = reach.recipients.length;
  const canReview = !draft && (!saved || !!saved.name.trim()) && reach.valid;
  const scope = draft ? 'Boundary preview' : saved?.name || 'All app users';

  return <aside className="ops-sidebar ops-command-sidebar" aria-label="Alert operations summary">
    <div className="ops-sidebar-heading"><span>ALERT OPERATIONS</span><span className="ops-demo-badge">Demo data</span></div>
    <button className="ops-command-scope" onClick={onChooseArea} aria-label={`Choose geofence. Current scope: ${scope}`}>
      <MapPin size={15} /><span><small>{draft ? 'DRAWING AREA' : saved ? 'SELECTED GEOFENCE' : 'ACROSS ALL AREAS'}</small><strong>{scope}</strong></span><ChevronRight size={14} />
    </button>

    <section className="ops-glass ops-command-card ops-alert-reach" aria-labelledby="alert-reach-title">
      <div className="ops-card-heading"><h2 id="alert-reach-title"><Radio size={14} />Alert reach</h2><span className="ops-command-tag">{draft ? 'Preview' : 'App users'}</span></div>
      {reach.valid ? <>
        <div className="ops-reach-metric" aria-live="polite"><strong>{eligible}</strong><span>eligible now<small>of {reach.total} located users</small></span><span className="ops-reach-ratio">{reach.total ? Math.round(eligible / reach.total * 100) : 0}<small>%</small></span></div>
        <div className="ops-reach-track" role="meter" aria-label="Share of located users eligible for an active-user alert" aria-valuemin={0} aria-valuemax={100} aria-valuenow={reach.total ? Math.round(eligible / reach.total * 100) : 0} aria-valuetext={`${eligible} of ${reach.total} located app users`}><span style={{ width: `${reach.total ? eligible / reach.total * 100 : 0}%` }} /></div>
        <p className="ops-command-note">Active ≤5 min · notifications enabled</p>
        <div className="ops-reach-gaps">
          <span title="Last shared location is older than 60 minutes"><Clock3 size={12} /><strong>{reach.stale}</strong>stale locations</span>
          <span title="Notifications disabled. May also have a stale location."><BellOff size={12} /><strong>{reach.notificationsOff}</strong>alerts off</span>
        </div>
        <button className="ops-command-link" title="Also include users whose location was shared 5–60 minutes before the demo snapshot" disabled={!canReview || !reach.recentEligible} onClick={() => onReview('all', false)}>
          <span>Include recent locations <strong>+{reach.recentEligible}</strong></span><ArrowUpRight size={13} />
        </button>
      </> : <div className="ops-command-empty"><MapPin size={22} /><strong>Finish your boundary</strong><p>{getGeofenceError(draft!)}</p></div>}
      <p className="ops-command-note ops-unlocated-note">{reach.unavailable} unlocated users across all areas.</p>
    </section>

    <section className="ops-glass ops-command-card ops-quick-audience" aria-labelledby="quick-audience-title">
      <div className="ops-card-heading"><h2 id="quick-audience-title">Message a group</h2><Users size={14} /></div>
      <p className="ops-command-note">Eligible active users · groups may overlap</p>
      <div className="ops-quick-audience-grid">{reach.groups.map(group => {
        const Icon = groupIcons[group.id];
        return <button key={group.id} data-demo={`audience-${group.id}`} disabled={!canReview || !group.eligible} onClick={() => onReview(group.id)} title={group.description} aria-label={`Preview ${group.label} alert: ${group.eligible} eligible active users`}>
          <Icon size={14} /><span>{group.label}</span><strong>{reach.valid ? group.eligible : '—'}</strong><ChevronRight size={12} />
        </button>;
      })}</div>
      {draft && <p className="ops-command-note">Save or cancel the boundary to preview recipients.</p>}
    </section>

    <section className="ops-glass ops-command-card ops-latest-broadcast" aria-labelledby="latest-broadcast-title">
      <div className="ops-card-heading"><h2 id="latest-broadcast-title"><History size={14} />Latest broadcast</h2><button onClick={onHistory}>History<ArrowUpRight size={12} /></button></div>
      {latest ? <button className="ops-latest-message" onClick={onHistory} aria-label="View latest broadcast in delivery history">
        <span className="ops-latest-message-meta"><span className={`ops-broadcast-state is-${latest.status}`}>{latest.status === 'delivered' ? 'Simulated' : latest.status === 'sending' ? 'Simulating' : 'Failed'}</span><time dateTime={latest.createdAt}>{formatRelativeTime(latest.createdAt)}</time></span>
        <span className="ops-latest-message-content">{latest.content}</span>
        <span className="ops-latest-message-audience">{latest.audience!.recipientIds.length} recipients · {audienceLabel(latest.audience!)}</span>
      </button> : <p className="ops-command-history-empty">{draft ? 'Save this boundary to start its alert history.' : saved ? 'No app alert sent to this geofence yet.' : 'No app broadcasts yet. Preview an audience to get started.'}</p>}
    </section>

    <button className="ops-broadcast-button" disabled={!canReview || !eligible} onClick={() => onReview('all')}>
      <span className="ops-broadcast-icon"><Radio size={17} /></span><span><strong>Preview alert audience</strong><small>{draft ? 'Save or cancel the boundary first' : eligible ? `${eligible} eligible users · review their locations` : 'No active users eligible in this area'}</small></span><ArrowUpRight size={17} />
    </button>
  </aside>;
}
