import { Ambulance, ArrowUpRight, Flag, Navigation, Pause, Play, RotateCcw, Truck, X } from 'lucide-react';
import { formatRouteDistance, getRouteProgress, RESPONDER_DEMO_SPEED, type ResponderRoute } from '../../lib/responder-routes';
import { responderTeams } from '../../lib/dashboard-data';

interface Props {
  route: ResponderRoute;
  elapsed: number;
  paused: boolean;
  onToggle: () => void;
  onReplay: () => void;
  onFocus: () => void;
  onClose: () => void;
}

export function ResponderRouteCard({ route, elapsed, paused, onToggle, onReplay, onFocus, onClose }: Props) {
  const trip = getRouteProgress(route, elapsed);
  const team = responderTeams.find(item => item.id === route.teamId)!;
  const Icon = route.vehicle === 'ambulance' ? Ambulance : Truck;
  return <section className="ops-selection ops-glass ops-route-detail" aria-label="Responder route details">
    <div className="ops-card-heading"><span className="ops-route-demo">DEMO TRACKING · {RESPONDER_DEMO_SPEED}×</span><button className="ops-small-icon" aria-label="Close route details" onClick={onClose}><X size={14} /></button></div>
    <div className="ops-route-title"><span style={{ color: route.color }}><Icon size={22} /></span><div><h2>{route.label}</h2><small>{team.name} · {team.personnel} personnel</small></div></div>
    <div className="ops-route-assignment"><Navigation size={12} /><span>{trip.arrived ? 'Arrived at destination' : paused ? 'Demo paused' : 'En route'} · {route.assignment}</span></div>
    <div className="ops-route-target"><Flag size={15} style={{ color: route.color }} /><span><small>DESTINATION</small><strong>{route.destination}</strong></span></div>
    <dl className="ops-route-metrics"><div><dt>Remaining</dt><dd>{formatRouteDistance(trip.remainingMeters)}</dd></div><div><dt>Model ETA</dt><dd>{trip.arrived ? 'Arrived' : `${Math.ceil(trip.remainingSeconds / 60)} min`}</dd></div></dl>
    <div className="ops-route-progress" role="progressbar" aria-label="Route progress" aria-valuenow={Math.round(trip.progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${trip.progress * 100}%`, background: route.color }} /></div>
    <div className="ops-route-actions"><button onClick={onFocus}>Fit route<ArrowUpRight size={12} /></button><button onClick={trip.arrived ? onReplay : onToggle}>{trip.arrived ? <RotateCcw size={12} /> : paused ? <Play size={12} /> : <Pause size={12} />}{trip.arrived ? 'Replay demo' : paused ? 'Resume' : 'Pause'}</button></div>
    <p className="ops-route-note">Simulated movement on a cached road route. ETA excludes live traffic and closures.</p>
  </section>;
}
