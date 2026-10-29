import { useEffect, useReducer } from 'react';
import { Ambulance, ArrowUp, BatteryFull, Bell, CheckCheck, CornerUpLeft, CornerUpRight, Footprints, MapPin, Navigation, Radio, Send, ShieldCheck, Signal, Smartphone, Wifi } from 'lucide-react';
import { createNavigationPresentation, demoShelters, navigationReducer, routeMeters, routePosition, type DemoRoute, type NavigationChapter } from '../../lib/presentation-navigation';
import '../../../styles/presentation-mobile.css';

function NavigationMap({ route, progress, responder, compact = false }: { route: DemoRoute; progress: number; responder: boolean; compact?: boolean }) {
  const location = routePosition(route, progress);
  const destination = route.points[route.points.length - 1];
  return <div className={`presentation-navigation-map${compact ? ' is-compact' : ''}`} role="img" aria-label={`Illustrative ${responder ? 'ambulance' : 'walking'} route to ${route.destination}, ${Math.round(progress * 100)} percent complete`}>
    <svg viewBox="0 0 320 360" aria-hidden="true">
      <rect width="320" height="360" fill="#304439"/>
      <path d="M178 -20Q140 75 176 138T170 268T179 380" stroke="#2c6472" strokeWidth="28" fill="none"/>
      <g fill="#415647" stroke="#52604a" strokeWidth="1"><rect x="15" y="78" width="65" height="105" rx="6"/><rect x="125" y="80" width="20" height="105" rx="5"/><rect x="206" y="136" width="27" height="65" rx="4"/><rect x="267" y="136" width="38" height="65" rx="4"/><rect x="13" y="245" width="81" height="37" rx="4"/><rect x="125" y="245" width="27" height="39" rx="4"/><rect x="204" y="245" width="28" height="39" rx="4"/></g>
      <path d="M-5 60H330M110 -5V370M250 -5V370M-5 230H330M-5 300H330M250 120H330" stroke="#1c2b26" strokeWidth="16" fill="none"/>
      <path d="M-5 60H330M110 -5V370M250 -5V370M-5 230H330M-5 300H330M250 120H330" stroke="#8b9b87" strokeWidth="9" fill="none"/>
      <g fill="#c0cdbd" fontSize="9"><text x="16" y="49">North road</text><text x="15" y="218">Community avenue</text><text x="126" y="289">Service road</text></g>
      {!responder && demoShelters.filter(shelter => shelter.id !== route.id).map(shelter => {
        const [x, y] = shelter.points[shelter.points.length - 1];
        return <g key={shelter.id} transform={`translate(${x},${y})`}><circle r="9" fill={shelter.open ? '#668d71' : '#6f665f'} stroke="#e1e8dc" strokeWidth="1.5"/><text x="0" y="3" textAnchor="middle" fill="#fff" fontSize="10">{shelter.open ? '+' : '×'}</text></g>;
      })}
      <polyline points={route.points.map(point => point.join(',')).join(' ')} stroke="#152c29" strokeWidth="12" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={route.points.map(point => point.join(',')).join(' ')} stroke="#81e6cf" strokeWidth="6" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      <g transform={`translate(${destination[0]},${destination[1]})`}><circle r="12" fill={responder ? '#ec8b79' : '#b4dac6'} stroke="#fff" strokeWidth="2"/><circle r="4" fill="#183b30"/></g>
      <g transform={`translate(${location.point[0]},${location.point[1]})`}>
        <circle r="22" fill="#98f0da25"/>
        <g transform={`rotate(${location.bearing})`}>
          {responder ? <><rect x="-9" y="-16" width="18" height="32" rx="5" fill="#eef5ee" stroke="#132e27" strokeWidth="2"/><rect x="-6" y="-11" width="12" height="6" rx="2" fill="#4c7376"/><path d="M-5 5H5M0 0V10" stroke="#d6655f" strokeWidth="3"/><path d="M-7 -3H0" stroke="#fc8675" strokeWidth="3"/><path d="M0 -3H7" stroke="#7daff3" strokeWidth="3"/></> : <path d="M0 -14L11 11L0 6L-11 11Z" fill="#f1fff9" stroke="#173d32" strokeWidth="2"/>}
        </g>
      </g>
      <text x="12" y="347" fill="#c6d8cd" fontSize="8">SIMULATED STREETS · NOT FOR REAL NAVIGATION</text>
    </svg>
  </div>;
}

export function PresentationNavigation({ chapter, playing, speed }: { chapter: NavigationChapter; playing: boolean; speed: number }) {
  const [state, dispatch] = useReducer(navigationReducer, chapter, createNavigationPresentation);
  const responder = chapter === 'mobile-responder';
  const arrived = state.progress >= 1;
  const route = state.route;
  const position = route ? routePosition(route, state.progress) : null;
  const label = responder ? 'Ambulance 01' : 'Resident · Alex';
  const remaining = position?.remainingMeters || 0;
  const minutes = Math.max(1, Math.ceil(remaining / (responder ? 8 : 1.3) / 60));

  useEffect(() => {
    if (!playing || !route || arrived) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const seconds = Math.min(.25, Math.max(0, now - previous) / 1000);
      previous = now;
      if (!document.hidden) dispatch({ type: 'tick', seconds: seconds * speed });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, speed, route, arrived]);

  return <section className="presentation-mobile-stage" aria-label={responder ? 'Responder navigation presentation' : 'Resident evacuation presentation'}>
    <header className="presentation-mobile-stage-heading"><span><Smartphone size={18}/>{responder ? 'DISPATCH TO DESTINATION' : 'EVACUATION ALERT TO SAFE ARRIVAL'}</span><small>Illustrative routes · fictional locations and availability</small></header>
    <div className="presentation-mobile-layout">
      <div className="presentation-mobile-narration" data-demo="mobile-narration" aria-hidden="true"/>
      <div className="presentation-mobile-device" aria-label={`${label} phone demo`}>
        <div className="presentation-mobile-status" aria-hidden="true"><span>9:41</span><i/><span><Signal size={13}/><Wifi size={13}/><BatteryFull size={17}/></span></div>
        <header className="presentation-mobile-header"><div><strong>Mobile Phone</strong><small>{responder ? 'Responder app · Ambulance 01' : 'Resident app · Alex'}</small></div><span><i/>Demo connected</span></header>
        <div className="presentation-mobile-screen presentation-navigation-screen">
          {!state.delivered ? <div className="presentation-navigation-waiting" data-demo="navigation-ready"><span className="presentation-mobile-icon">{responder ? <Ambulance size={25}/> : <ShieldCheck size={25}/>}</span><span className="presentation-mobile-eyebrow">{responder ? 'ON DUTY · AVAILABLE' : 'YOUR COMMUNITY, CONNECTED'}</span><h2>{responder ? 'Ready to respond.' : 'Stay informed.'}</h2><p>{responder ? 'The assigned emergency location travels with the dispatch alert.' : 'An evacuation alert opens directions to the nearest available sample center.'}</p><div className="presentation-mobile-card"><Bell size={20}/><h3>Waiting for command center</h3><p>The next alert will open the map automatically.</p></div></div> : <>
            <div className="presentation-navigation-received" data-demo="navigation-received" role="status"><Bell size={16}/><span><strong>{responder ? 'Medical dispatch received' : 'Evacuation alert received'}</strong><small>Map opened automatically · demo</small></span><CheckCheck size={16}/></div>
            {route && position ? <div data-demo="navigation-phone">
              <div className="presentation-navigation-instruction"><span>{arrived ? <MapPin size={27}/> : position.nextTurn === 'Turn left' ? <CornerUpLeft size={27}/> : position.nextTurn === 'Turn right' ? <CornerUpRight size={27}/> : <ArrowUp size={27}/>}</span><div><small>{arrived ? 'DEMO JOURNEY COMPLETE' : `IN ${position.turnMeters} M · SAMPLE GUIDANCE`}</small><strong>{arrived ? 'You have arrived' : position.nextTurn}</strong></div></div>
              <NavigationMap route={route} progress={state.progress} responder={responder}/>
              <div className="presentation-navigation-summary" data-demo="navigation-destination"><span>{responder ? <Ambulance size={18}/> : <Footprints size={18}/>}<strong>{arrived ? 'Arrived' : `${minutes} min`}</strong><small>{(remaining / 1000).toFixed(1)} km · {responder ? 'Driving' : 'Walking'}</small></span><h3>{route.destination}</h3><p>{responder ? 'Incident location attached to dispatch' : 'Nearest available sample center · 120 spaces'}</p><small>Illustrative journey · accelerated for presentation</small></div>
            </div> : <div className="presentation-mobile-card"><h3>No available sample route</h3><p>The operator must confirm an evacuation destination.</p></div>}
          </>}
        </div>
        <div className="presentation-navigation-tab"><Navigation size={17}/><span>{route ? 'Navigation active' : 'My map'}</span><small>Demo</small></div>
        <div className="presentation-mobile-home-indicator" aria-hidden="true"/>
      </div>
      <aside className="presentation-mobile-command" aria-label="Simulated dispatch control">
        <span className="presentation-mobile-eyebrow"><Radio size={14}/>COMMAND CENTER</span><h2>{responder ? <>Send the alert.<br/>Set the destination.</> : <>Guide residents<br/>to a safe place.</>}</h2>
        <p>{responder ? 'The ambulance receives the incident coordinates with its alert. Navigation starts on receipt.' : 'The evacuation alert selects the closest available center using the sample route distances.'}</p>
        <div className="presentation-mobile-card" data-demo="navigation-dispatch"><span className="presentation-mobile-eyebrow">{responder ? 'DIRECT DISPATCH · AMBULANCE 01' : 'GEOFENCE ALERT · RESIDENTS'}</span><h3>{responder ? 'Medical assistance required' : 'Evacuate the affected area'}</h3><p>{responder ? 'DEMO: Assist two people at the community hall. One person needs mobility support.' : 'DEMO: Proceed to the nearest available evacuation center shown on your map.'}</p><button className="presentation-mobile-primary" data-demo="navigation-send" disabled={state.delivered} onClick={() => dispatch({ type: 'receive-alert' })}><Send size={16}/>{state.delivered ? 'Demo alert delivered' : responder ? 'Send ambulance dispatch · demo' : 'Send evacuation alert · demo'}</button></div>
        {route && <><div className="presentation-mobile-event" data-demo="navigation-tracking"><span className="presentation-mobile-icon"><Navigation size={19}/></span><div><small>{responder ? 'RESPONDER ROUTE' : 'RESIDENT ROUTE'}</small><strong>{arrived ? 'Destination reached · demo' : `${label} · navigating`}</strong><p>{route.destination}</p><small>{(routeMeters(route) / 1000).toFixed(1)} km sample route · {Math.round(state.progress * 100)}% complete</small></div></div><NavigationMap route={route} progress={state.progress} responder={responder} compact/></>}
        {!responder && <p className="presentation-navigation-selection" data-demo="navigation-nearest"><ShieldCheck size={15}/>The closer Riverside shelter is closed. Community gym is the nearest available sample center.</p>}
        <p className="presentation-mobile-disclaimer"><ShieldCheck size={15}/>Presentation only. Routes, shelter status and movement are fictional. No device is tracked or dispatched.</p>
      </aside>
    </div>
  </section>;
}
