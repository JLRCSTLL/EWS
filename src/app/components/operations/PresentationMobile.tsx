import { useReducer } from 'react';
import { ArrowLeft, ArrowRight, BatteryFull, Bell, Check, CheckCheck, ChevronRight, HeartHandshake, Home, MapPin, Radio, Send, ShieldCheck, Signal, Smartphone, UserRound, Wifi } from 'lucide-react';
import { createMobilePresentation, mobilePresentationLocation, mobilePresentationReducer, type MobilePresentationChapter, type MobilePresentationPage } from '../../lib/presentation-mobile';
import { presentationMessage } from '../../lib/presentation-tour';
import '../../../styles/presentation-mobile.css';

function SampleLocationMap({ shared }: { shared: boolean }) {
  return <div className={`presentation-mobile-map${shared ? ' is-sharing' : ''}`} role="img" aria-label={shared ? 'Illustrative map with Alex’s fictional shared position inside the sample alert area' : 'Illustrative map, location not yet shared'}>
    <svg viewBox="0 0 320 145" aria-hidden="true"><rect width="320" height="145" fill="#263c33"/><path d="M225 -10Q157 44 203 83T166 160" stroke="#52758a" strokeWidth="27" fill="none"/>
      <path d="M-10 35L330 130M-10 100L330 18M48 -10L104 160M126 -10L182 160M273 -10L298 160" stroke="#95aa9b" strokeWidth="5" fill="none" opacity=".48"/>
      <path d="M43 34L130 19L173 69L146 130L55 117Z" fill="#b4daca20" stroke="#bddfcc" strokeWidth="2" strokeDasharray="5 4"/>
      {shared && <g><circle cx="108" cy="76" r="22" fill="#b4daca24"/><circle cx="108" cy="76" r="8" fill="#b4daca" stroke="#f0f4f1" strokeWidth="3"/></g>}
      <text x="224" y="22" fill="#d0ddd5" fontSize="10">Marikina</text><text x="14" y="139" fill="#d0ddd5" fontSize="9">Illustrative map · sample location</text>
    </svg>
  </div>;
}

export function PresentationMobile({ chapter }: { chapter: MobilePresentationChapter }) {
  const [state, dispatch] = useReducer(mobilePresentationReducer, chapter, createMobilePresentation);
  const navigate = (page: MobilePresentationPage) => dispatch({ type: 'navigate', page });
  const nav = [{ page: 'home', label: 'Home', icon: Home }, { page: 'alerts', label: 'Alerts', icon: Bell },
    { page: 'help', label: 'Get help', icon: HeartHandshake }, { page: 'area', label: 'My area', icon: MapPin }, { page: 'account', label: 'Account', icon: UserRound }] as const;
  const alertCard = <button className="presentation-mobile-notification" data-demo="mobile-notification" onClick={() => dispatch({ type: 'open-alert' })}>
    <span className="presentation-mobile-icon is-alert"><Bell size={19}/></span><span><small>COMMAND CENTER · JUST NOW</small><strong>Flood advisory</strong><span>Prepare your emergency bag and follow local guidance.</span><small>{state.acknowledged ? 'Acknowledged' : '1 new alert · tap to read'}</small></span><ChevronRight size={17}/>
  </button>;
  return <section className="presentation-mobile-stage" aria-label="Mobile app presentation">
    <header className="presentation-mobile-stage-heading"><span><Smartphone size={18}/>FROM COMMAND CENTER TO PHONE</span><small>Interactive simulation · no real alerts, GPS or requests</small></header>
    <div className="presentation-mobile-layout">
      <div className="presentation-mobile-narration" data-demo="mobile-narration" aria-hidden="true"/>
      <div className="presentation-mobile-device" aria-label="TANOVIQ mobile app demo">
        <div className="presentation-mobile-status" aria-hidden="true"><span>9:41</span><i/><span><Signal size={13}/><Wifi size={13}/><BatteryFull size={17}/></span></div>
        <header className="presentation-mobile-header"><div><strong>TANOVIQ</strong><small>Personnel app</small></div><span><i/>Demo connected</span><span className="presentation-mobile-avatar">AL</span></header>
        <div className="presentation-mobile-screen">
          {state.page === 'home' && <div data-demo="mobile-home-screen"><span className="presentation-mobile-eyebrow">YOUR COMMAND CENTER, WITH YOU</span><h2>Hello, Alex.</h2><p className="presentation-mobile-muted">Stay informed. Stay connected.</p>
            {alertCard}<div className="presentation-mobile-card"><span className="presentation-mobile-eyebrow">DUTY & LOCATION</span><h3>{state.sharing ? 'Your location is shared' : 'Ready when you are'}</h3><p>{state.sharing ? 'Your sample position is visible to the command center.' : 'Start a duty session to share your position with approved operators.'}</p><button className="presentation-mobile-secondary" onClick={() => navigate('area')}>View my area<MapPin size={15}/></button></div>
            <div className="presentation-mobile-shortcuts"><button onClick={() => navigate('help')}><HeartHandshake size={23}/><strong>Request help</strong><small>Contact your center</small></button><button onClick={() => navigate('account')}><ShieldCheck size={23}/><strong>My profile</strong><small>Emergency needs</small></button></div>
          </div>}
          {state.page === 'alerts' && <><span className="presentation-mobile-eyebrow">FROM YOUR COMMAND CENTER</span><h2>Your alerts</h2>{state.alertOpen ? <article className="presentation-mobile-card presentation-mobile-alert">
            <button className="presentation-mobile-back" onClick={() => navigate('alerts')}><ArrowLeft size={14}/>All alerts</button><span className="presentation-mobile-priority">Critical priority · demo</span><h3>Flood advisory</h3><small>Marikina river corridor · just now</small><p data-demo="mobile-alert-message">{presentationMessage}</p>
            <button data-demo="mobile-acknowledge" className="presentation-mobile-primary" disabled={state.acknowledged} onClick={() => dispatch({ type: 'acknowledge' })}><CheckCheck size={17}/>{state.acknowledged ? 'Acknowledged' : 'I have read this alert'}</button>
            {state.acknowledged && <p className="presentation-mobile-confirmation" role="status">Your read receipt is visible to the command center.</p>}
            <button className="presentation-mobile-secondary" onClick={() => navigate('help')}>Request assistance<ArrowRight size={16}/></button>
          </article> : alertCard}</>}
          {state.page === 'account' && <><span className="presentation-mobile-eyebrow">YOUR ACCOUNT</span><h2>Account & privacy</h2><section className="presentation-mobile-card" data-demo="mobile-profile"><span className="presentation-mobile-avatar">AL</span><h3>Alex · Demo</h3><p>Preferred name · fictional account</p><dl><div><dt>Email</dt><dd>••••@example.invalid</dd></div><div><dt>Phone</dt><dd>•••• ••• 0100</dd></div><div><dt>Age range</dt><dd>60 and above</dd></div><div><dt>PWD status</dt><dd>Yes · shared by user</dd></div><div><dt>Assistance</dt><dd>Mobility & transport</dd></div></dl><p className="presentation-mobile-confirmation"><ShieldCheck size={16}/>Contacts stay masked. Emergency needs are shared with consent.</p></section></>}
          {state.page === 'area' && <><span className="presentation-mobile-eyebrow">LOCATION & EXPOSURE</span><h2>Your area</h2><SampleLocationMap shared={state.sharing}/><section className="presentation-mobile-card" data-demo="mobile-location"><h3>{state.sharing ? 'On duty · location shared' : 'Start your duty session'}</h3><p>{state.sharing ? `${mobilePresentationLocation.lat.toFixed(5)}, ${mobilePresentationLocation.lng.toFixed(5)} · ±12 m · sample position` : 'During duty, approved operators can see your shared position.'}</p>
            <button className="presentation-mobile-primary" data-demo="mobile-share-location" disabled={state.sharing} onClick={() => dispatch({ type: 'share-location' })}><MapPin size={17}/>{state.sharing ? 'Sample location shared' : 'Start demo duty'}</button><small>This presentation uses a fictional location. On a phone, location sharing requires your permission.</small></section></>}
          {state.page === 'help' && <><span className="presentation-mobile-eyebrow">WE’RE CONNECTED</span><h2>How can we help?</h2>{state.request ? <section className="presentation-mobile-card" data-demo="mobile-request-status" role="status"><span className="presentation-mobile-priority is-success">{state.request.status === 'assigned' ? 'Team assigned' : 'Request received'}</span><h3>{state.request.type}</h3><p>{state.request.people} people need assistance</p><p>{state.request.note}</p><ol className="presentation-mobile-request-steps"><li className="is-done"><Check size={16}/>Request received</li><li className={state.request.status === 'assigned' ? 'is-done' : ''}><Check size={16}/>Reviewed by command center</li><li className={state.request.status === 'assigned' ? 'is-done' : ''}><Check size={16}/>Response team assigned</li></ol>{state.request.status === 'assigned' && <p className="presentation-mobile-confirmation">Response 01 · demo assignment</p>}<small>Simulation only. No team is dispatched.</small></section> : <form className="presentation-mobile-card presentation-mobile-form" onSubmit={event => { event.preventDefault(); dispatch({ type: 'send-request' }); }}>
            <label>Assistance needed<select aria-label="Mobile demo assistance needed" value={state.assistance} onChange={event => dispatch({ type: 'edit-request', field: 'assistance', value: event.target.value })}><option>Medical assistance</option><option>Evacuation</option><option>Rescue</option></select></label>
            <label>People needing assistance<input aria-label="Mobile demo people needing assistance" type="number" min={1} max={20} value={state.people} onChange={event => dispatch({ type: 'edit-request', field: 'people', value: event.target.value })}/></label>
            <label>What should the team know?<textarea aria-label="Mobile demo assistance details" rows={3} maxLength={500} required value={state.note} onChange={event => dispatch({ type: 'edit-request', field: 'note', value: event.target.value })}/></label>
            <span className="presentation-mobile-confirmation"><MapPin size={15}/>{state.sharing ? 'Your sample location will be attached' : 'No location attached'}</span><button data-demo="mobile-send-help" className="presentation-mobile-primary" disabled={!state.note.trim()}><Send size={16}/>Send demo request</button>
          </form>}</>}
        </div>
        <nav className="presentation-mobile-nav" aria-label="Demo phone navigation">{nav.map(({ page, label, icon: Icon }) => <button key={page} data-demo={`mobile-nav-${page}`} aria-current={state.page === page ? 'page' : undefined} onClick={() => navigate(page)}><Icon size={20}/><span>{label}</span>{page === 'alerts' && !state.acknowledged && <i>1</i>}</button>)}</nav>
        <div className="presentation-mobile-home-indicator" aria-hidden="true"/>
      </div>
      <aside className="presentation-mobile-command" aria-label="Simulated command-center updates">
        <span className="presentation-mobile-eyebrow"><Radio size={14}/>COMMAND CENTER</span><h2>The other side<br/>of the message.</h2><p>See how the phone’s actions return to the operator.</p>
        <div className="presentation-mobile-person"><span className="presentation-mobile-avatar">AL</span><div><strong>Alex · Demo</strong><small>Preferred name · contacts masked</small></div></div>
        <div className="presentation-mobile-event" data-demo="mobile-command-receipt" role="status"><span className="presentation-mobile-icon"><CheckCheck size={19}/></span><div><small>ALERT RECEIPT</small><strong>{state.acknowledged ? 'Read by Alex' : 'Delivered · awaiting acknowledgment'}</strong><p>{state.acknowledged ? 'The recipient confirmed reading the instructions.' : 'Delivery and acknowledgment are separate events.'}</p></div></div>
        <div className="presentation-mobile-event" data-demo="mobile-command-location" role="status"><span className="presentation-mobile-icon"><MapPin size={19}/></span><div><small>FIELD LOCATION</small><strong>{state.sharing ? 'On duty · position visible' : 'No duty location shared'}</strong><p>{state.sharing ? 'Sample GPS position · Marikina · ±12 m' : 'The operator sees a position after the person starts sharing.'}</p></div></div>
        {state.sharing && <SampleLocationMap shared/>}
        <div className="presentation-mobile-event" data-demo="mobile-command-request" role="status"><span className="presentation-mobile-icon"><HeartHandshake size={19}/></span><div><small>ASSISTANCE INBOX</small><strong>{state.request ? `${state.request.type} · ${state.request.people} people` : 'No assistance request yet'}</strong><p>{state.request ? state.request.note : 'Requests arrive with the person’s message and any shared position.'}</p>{state.request && <small>{state.request.location ? 'Location attached' : 'No location attached'} · {state.request.status === 'assigned' ? 'Response 01 assigned' : 'Awaiting operator review'}</small>}</div></div>
        {state.request && <button data-demo="mobile-assign-response" className="presentation-mobile-primary" disabled={state.request.status === 'assigned'} onClick={() => dispatch({ type: 'assign-team' })}><Check size={16}/>{state.request.status === 'assigned' ? 'Demo team assigned' : 'Assign Response 01 · demo'}</button>}
        <p className="presentation-mobile-disclaimer"><ShieldCheck size={15}/>Fictional account and location. This chapter does not contact a server or play an alarm.</p>
      </aside>
    </div>
  </section>;
}
