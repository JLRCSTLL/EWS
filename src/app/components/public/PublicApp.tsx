import { useEffect, useRef, useState } from 'react';
import { Accessibility, ArrowLeft, ArrowRight, Bell, Check, CheckCheck, ChevronRight, HeartHandshake, Home, MapPin, Navigation, Radio, Search, ShieldCheck, Siren, Smartphone, UserRound, Waves, X } from 'lucide-react';
import { demoGeofences } from '../../lib/residents';
import { geofenceDistance, type AlertGeofence } from '../../lib/geofencing';
import { acknowledgeAlert, addRequest, checkInSafe, demoPlaces, isOpenRequest, publicInbox, publicProfiles, requestStatusLabels, updateRequest, type HelpType } from '../../lib/public-demo';
import { mutatePublicState, useCommandMessages, usePublicDemo } from '../../lib/public-demo-store';
import { PublicMap } from './PublicMap';
import '../../../styles/public-app.css';

type Page = 'home' | 'alerts' | 'nearby' | 'account' | 'help' | 'activity';
interface Alert { id: string; title: string; content: string; priority: string; source: string; area?: AlertGeofence; createdAt?: string; sample?: boolean }
const pages: Page[] = ['home', 'alerts', 'nearby', 'account', 'help', 'activity'];
function routePage(): Page { const value = window.location.hash.split('/')[2] as Page; return pages.includes(value) ? value : 'home'; }
const time = (value: string) => new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const services = [
  { page: 'alerts' as Page, label: 'Alerts', icon: Bell, detail: 'Local announcements and warnings' },
  { page: 'nearby' as Page, label: 'Evacuate', icon: Home, detail: 'Evacuation centers and support places' },
  { page: 'help' as Page, label: 'Get help', icon: HeartHandshake, detail: 'Request assistance from the command center' },
  { page: 'activity' as Page, label: 'My status', icon: ShieldCheck, detail: 'Check-ins and assistance request updates' },
];

export default function PublicApp() {
  const [page, setPage] = useState<Page>(routePage);
  const [profileId, setProfileId] = useState(() => { try { return localStorage.getItem('e-ligtas-public-profile') || publicProfiles[0].resident.id; } catch { return publicProfiles[0].resident.id; } });
  const profile = publicProfiles.find(item => item.resident.id === profileId) || publicProfiles[0];
  const resident = profile.resident;
  const state = usePublicDemo();
  const messages = useCommandMessages();
  const inbox = publicInbox(messages, resident.id);
  const area = demoGeofences.find(area => area.id === profile.areaId)!;
  const shareLocation = state.preferences.find(item => item.residentId === resident.id)?.shareLocation ?? true;
  const checkIn = state.checkIns.find(item => item.residentId === resident.id);
  const requests = state.requests.filter(item => item.residentId === resident.id);
  const activeRequest = requests.find(isOpenRequest);
  const acknowledged = new Set(state.acknowledgments.filter(item => item.residentId === resident.id).map(item => item.messageId));
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [helpType, setHelpType] = useState<HelpType>('Evacuation');
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState('');
  const [includeLocation, setIncludeLocation] = useState(shareLocation);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const scroll = useRef<HTMLElement>(null);
  const sampleAlert: Alert = { id: 'sample-flood-' + profile.areaId, title: 'Flood watch in your area', content: 'This sample advisory demonstrates an alert for residents inside a monitored area. In a connected service, your local command center would provide the current situation and verified instructions here.', priority: 'high', source: 'Sample flood scenario', area, sample: true };
  const alerts: Alert[] = [...inbox.map(message => ({ id: message.id, title: message.category, content: message.content, priority: message.priority, source: message.sender + ' · demo', area: message.geofence, createdAt: message.createdAt })), sampleAlert];
  const unreadCount = alerts.filter(alert => !acknowledged.has(alert.id)).length;
  const visibleAlerts = alerts.filter(alert => (!unreadOnly || !acknowledged.has(alert.id)) && (alert.title + alert.content).toLowerCase().includes(query.toLowerCase()));
  const selectedFacility = demoPlaces.find(place => place.id === selectedPlace);
  const go = (next: Page) => { setSelectedAlert(null); setQuery(''); setError(''); window.location.hash = next === 'home' ? '/public' : '/public/' + next; setPage(next); scroll.current?.scrollTo({ top: 0 }); };
  const save = (change: Parameters<typeof mutatePublicState>[0], confirmation?: string) => {
    try { mutatePublicState(change); setError(''); if (confirmation) setNotice(confirmation); return true; }
    catch { setError('Could not save in this browser. Please check that browser storage is available.'); return false; }
  };
  const openAlert = (alert: Alert) => { window.history.pushState(null, '', '#/public/alerts'); setSelectedAlert(alert); setPage('alerts'); scroll.current?.scrollTo({ top: 0 }); };
  const markSafe = () => save(current => checkInSafe(current, resident, shareLocation, new Date().toISOString()), 'Your safe check-in is visible in the command-center demo.');
  const changeProfile = (id: string) => { setProfileId(id); setSelectedAlert(null); setSelectedPlace(null); setNotice('Demo resident switched. The inbox now follows this resident’s targeted broadcasts.'); try { localStorage.setItem('e-ligtas-public-profile', id); } catch { /* Session selection still works. */ } };
  useEffect(() => {
    const changed = () => { setPage(routePage()); setSelectedAlert(null); setQuery(''); scroll.current?.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    const previousTitle = document.title;
    document.title = 'TANOVIQ Personnel App · Demo';
    const theme = document.querySelector('meta[name="theme-color"]');
    const previous = theme?.getAttribute('content'); theme?.setAttribute('content', '#ffffff');
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); document.title = previousTitle; if (previous) theme?.setAttribute('content', previous); };
  }, []);
  useEffect(() => { setIncludeLocation(shareLocation); }, [shareLocation, profileId]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 6000); return () => window.clearTimeout(timer); }, [notice]);
  const submitHelp = (event: React.FormEvent) => {
    event.preventDefault();
    const at = new Date().toISOString();
    if (!Number.isInteger(people) || people < 1 || people > 20) { setError('Choose 1 to 20 people for this demo request.'); return; }
    const saved = save(current => addRequest(current, { id: 'help-' + crypto.randomUUID(), residentId: resident.id, type: helpType, note: note.trim().slice(0, 300), people, location: includeLocation && resident.location ? { lat: resident.location.lat, lng: resident.location.lng } : null, status: 'new', createdAt: at, updatedAt: at }));
    if (saved) { setNote(''); go('activity'); setNotice('Request added to the command-center demo. No real responders are dispatched.'); }
  };

  return <div className="public-stage">
    <aside className="public-presentation">
      <a href="/" className="public-back-command"><ArrowLeft size={15} />Command center</a>
      <span className="public-concept-pill"><Smartphone size={13} />PUBLIC APP CONCEPT</span>
      <h1>TANOVIQ<br /><span>See Risk Before It Strikes.</span></h1>
      <p>Tanaw + Vision + IQ<br />Connected awareness. Coordinated response.</p>
      <div className="public-demo-connection"><i /><span>Connected demo workspace<small>Updates sync across tabs in this browser.</small></span></div>
      <ol><li><span>01</span>Send a targeted alert from TANOVIQ.</li><li><span>02</span>Read it in the resident’s inbox.</li><li><span>03</span>Send a check-in or request help.</li></ol>

      <p className="public-concept-disclaimer">Presentation mode uses fictional people and locations.</p>
    </aside>
    <section className="public-phone" aria-label="TANOVIQ public mobile application">
      <div className="public-concept-bar">Personnel application <span>DEMO</span></div>
      <header className="public-header">
        <button className="public-egov" onClick={() => go('home')} aria-label="Personnel home">TANOVIQ</button>
        <div className="public-header-actions"><button aria-label={`Open alerts, ${unreadCount} unread`} onClick={() => go('alerts')}><Bell size={21} />{unreadCount > 0 && <i>{unreadCount}</i>}</button><button className="public-avatar" aria-label="Open your demo profile" onClick={() => go('account')}>{profile.initials}</button></div>
      </header>
      <main ref={scroll} className="public-content">
        {notice && <div className="public-toast" role="status"><CheckCheck size={18} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss update"><X size={15} /></button></div>}
        {error && <div className="public-error" role="alert">{error}</div>}
        {page === 'home' && <>
          <div className="public-greeting"><p>Mabuhay, <strong>{profile.name.split(' ')[0]}!</strong></p><h2>A little closer.<br />A lot more connected.</h2></div>
          <button className="public-location" onClick={() => go('account')}><MapPin size={15} /><span>{profile.city}<small>Demo location</small></span><span className="public-location-date">{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span><ChevronRight size={15} /></button>
          <label className="public-search"><Search size={19} /><input aria-label="Search public services" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search alerts or services" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</label>
          {query ? <div className="public-search-results">{services.filter(service => (service.label + service.detail).toLowerCase().includes(query.toLowerCase())).map(service => <button key={service.page} onClick={() => go(service.page)}><service.icon size={20} /><span><strong>{service.label}</strong><small>{service.detail}</small></span><ChevronRight size={16} /></button>)}{!services.some(service => (service.label + service.detail).toLowerCase().includes(query.toLowerCase())) && <p>No matching service. Try alerts, evacuation, help, or status.</p>}</div> : <>
            <div className="public-services">{services.map(service => <button key={service.page} onClick={() => go(service.page)}><span><service.icon size={24} strokeWidth={1.7} /></span>{service.label}</button>)}</div>
            <section className="public-hero"><div className="public-hero-eyebrow"><ShieldCheck size={17} />TANOVIQ <span>PUBLIC SAFETY</span></div><h2>See Risk<br />Before It Strikes.</h2><p>Local alerts and a helping hand,<br />all in one place.</p><button onClick={() => go('alerts')}>Open TANOVIQ<ArrowRight size={16} /></button><div className="public-hero-art" aria-hidden="true"><div /><ShieldCheck size={76} strokeWidth={1} /><i /><i /></div></section>
            <button className="public-home-alert" onClick={() => openAlert(alerts[0])}><span className="public-alert-icon"><Waves size={23} /></span><span><small>{inbox.length ? 'FROM YOUR COMMAND CENTER' : 'SAMPLE ADVISORY'}</small><strong>{alerts[0].title}</strong><span>{profile.city} · {inbox.length ? 'New demo broadcast' : 'Flood monitoring scenario'}</span></span><ChevronRight size={18} /></button>
            <div className="public-section-title"><h3>Here for you</h3><span>Every step of the way</span></div>
            <div className="public-support-grid"><button className="public-safe-card" onClick={markSafe}><ShieldCheck size={26} /><strong>{checkIn ? 'You checked in safe' : 'I’m safe'}</strong><span>{checkIn ? 'Tap to update your check-in' : 'Let your command center know'}<ArrowRight size={14} /></span></button><button className="public-help-card" onClick={() => go('help')}><HeartHandshake size={26} /><strong>Request help</strong><span>Tell us what you need<ArrowRight size={14} /></span></button></div>
            {activeRequest && <button className="public-request-banner" onClick={() => go('activity')}><Radio size={18} /><span><strong>{requestStatusLabels[activeRequest.status]}</strong><small>{activeRequest.type} · Tap for updates</small></span><ChevronRight size={17} /></button>}
            <button className="public-nearby-teaser" onClick={() => go('nearby')}><span><MapPin size={25} /></span><div><strong>A place to turn to</strong><p>Explore demo evacuation centers<br />and community support.</p></div><ArrowRight size={18} /></button>
            <p className="public-small-note"><ShieldCheck size={13} />Sample alerts and locations. No real emergency service.</p>
          </>}
        </>}
        {page === 'alerts' && (selectedAlert ? <>
          <button className="public-page-back" onClick={() => setSelectedAlert(null)}><ArrowLeft size={17} />All alerts</button>
          <div className={`public-alert-detail is-${selectedAlert.priority}`}><span className="public-priority"><Waves size={15} />{selectedAlert.priority.toUpperCase()} · DEMO ALERT</span><h2>{selectedAlert.title}</h2><p className="public-alert-source">{selectedAlert.source}{selectedAlert.createdAt && <small>{time(selectedAlert.createdAt)}</small>}</p><p className="public-alert-body">{selectedAlert.content}</p><div className="public-alert-area"><MapPin size={17} /><span>{selectedAlert.area?.name || 'All eligible app users'}</span></div></div>
          <div className="public-context-note"><ShieldCheck size={18} /><p>{selectedAlert.sample ? 'This example illustrates a geofenced advisory. It is not a current warning.' : 'This broadcast was sent from the connected command-center demo and targeted your demo resident ID.'}</p></div>
          <button className="public-primary" onClick={() => save(current => acknowledgeAlert(current, resident.id, selectedAlert.id, new Date().toISOString()), 'Acknowledgment shared with the command-center demo.')} disabled={acknowledged.has(selectedAlert.id)}><CheckCheck size={18} />{acknowledged.has(selectedAlert.id) ? 'Acknowledged' : 'I’ve read this alert'}</button>
          <div className="public-action-pair"><button onClick={markSafe}><ShieldCheck size={18} />I’m safe</button><button onClick={() => go('help')}><HeartHandshake size={18} />Request help</button></div>
          <button className="public-nearby-teaser" onClick={() => go('nearby')}><MapPin size={24} /><div><strong>View support locations</strong><p>Demo evacuation and medical facilities</p></div><ChevronRight size={17} /></button>
        </> : <>
          <div className="public-page-title"><span>TANOVIQ / INBOX</span><h2>Your local alerts</h2><p>Updates that matter to your community.</p></div>
          <div className="public-inbox-connection"><Radio size={15} /><span>Command-center demo connected<small>Messages sync in this browser.</small></span></div>
          <label className="public-search"><Search size={18} /><input aria-label="Search alerts" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search announcements" /></label>
          <div className="public-filter-tabs"><button className={!unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(false)}>All alerts <span>{alerts.length}</span></button><button className={unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(true)}>Unread <span>{unreadCount}</span></button></div>
          <div className="public-alert-list">{visibleAlerts.map(alert => <button key={alert.id} onClick={() => openAlert(alert)} className={acknowledged.has(alert.id) ? 'is-read' : ''}><div><span className={`public-list-priority is-${alert.priority}`}>{alert.sample ? 'SAMPLE' : alert.priority.toUpperCase()}</span><small>{alert.createdAt ? time(alert.createdAt) : 'Demo scenario'}</small></div><strong>{alert.title}{!acknowledged.has(alert.id) && <i />}</strong><p>{alert.content}</p><span className="public-list-source">{alert.area?.name || profile.city}<ChevronRight size={17} /></span></button>)}</div>
          {!visibleAlerts.length && <div className="public-empty"><CheckCheck size={30} /><h3>You’re all caught up</h3><p>No alerts match this view.</p></div>}
          <p className="public-small-note">Only delivered demo broadcasts addressed to {resident.id} appear here.</p>
        </>)}
        {page === 'nearby' && <>
          <div className="public-page-title"><span>TANOVIQ / NEARBY</span><h2>Find a helping hand</h2><p>Explore sample support locations on the map.</p></div>
          <PublicMap location={resident.location!} area={area} selectedPlace={selectedPlace} onSelectPlace={setSelectedPlace} />
          <div className="public-map-caption"><span><i />Your demo location</span><span><i />Sample alert boundary</span></div>
          {selectedFacility && <div className="public-destination"><Navigation size={20} /><span><strong>{selectedFacility.name}</strong><small>Straight-line preview · not route guidance</small></span><button onClick={() => setSelectedPlace(null)} aria-label="Clear destination"><X size={17} /></button></div>}
          <div className="public-section-title"><h3>Support places</h3><span>Illustrative facilities</span></div>
          <div className="public-place-list">{demoPlaces.map(place => <button key={place.id} onClick={() => setSelectedPlace(place.id)} className={selectedPlace === place.id ? 'is-selected' : ''}><span className="public-facility-icon">{place.type === 'Medical support' ? <HeartHandshake size={23} /> : <Home size={23} />}</span><span><small>{place.type}</small><strong>{place.name}</strong><span>{(geofenceDistance(resident.location!, place) / 1000).toFixed(1)} km direct distance</span><span><Accessibility size={13} />Demo accessible facility</span></span><ChevronRight size={17} /></button>)}</div>
          <p className="public-small-note">Facilities, capacity and positions are fictional. This demo does not provide evacuation routing or current facility availability.</p>
        </>}
        {page === 'help' && <>
          <button className="public-page-back" onClick={() => go('home')}><ArrowLeft size={17} />Home</button>
          <div className="public-page-title"><span>TANOVIQ / ASSISTANCE</span><h2>You’re not alone.</h2><p>Tell your command center what you need.</p></div>
          <div className="public-context-note is-warm"><Siren size={21} /><p><strong>Presentation request only.</strong> This demo does not contact emergency services or dispatch real responders.</p></div>
          {activeRequest ? <div className="public-active-help"><Radio size={30} /><h3>You have an open demo request</h3><p>{activeRequest.type} · {requestStatusLabels[activeRequest.status]}</p><button className="public-primary" onClick={() => go('activity')}>View request status<ArrowRight size={17} /></button></div> : <form className="public-help-form" onSubmit={submitHelp}>
            <fieldset><legend>What do you need help with?</legend><div className="public-help-types">{(['Evacuation', 'Medical assistance', 'Rescue', 'Other assistance'] as HelpType[]).map(type => <label key={type} className={helpType === type ? 'is-active' : ''}><input type="radio" name="help-type" value={type} checked={helpType === type} onChange={() => setHelpType(type)} />{type}</label>)}</div></fieldset>
            <label>People needing assistance<input type="number" min={1} max={20} value={people} onChange={event => setPeople(Number(event.target.value))} required /></label>
            <label>Anything the team should know?<textarea value={note} maxLength={300} onChange={event => setNote(event.target.value)} placeholder="For example: We need an accessible vehicle. Use sample information." rows={3} /></label>
            <label className="public-location-consent"><input type="checkbox" checked={includeLocation} onChange={event => setIncludeLocation(event.target.checked)} /><span>Include my demo location<small>{profile.city} · fictional position</small></span><MapPin size={19} /></label>
            <button className="public-primary" type="submit"><HeartHandshake size={19} />Send demo request</button>
          </form>}
        </>}
        {page === 'activity' && <>
          <div className="public-page-title"><span>TANOVIQ / MY STATUS</span><h2>We’re keeping in touch.</h2><p>Your check-ins and assistance updates.</p></div>
          <section className="public-checkin-status"><ShieldCheck size={29} /><div><h3>{checkIn ? 'You reported safe' : 'Let your community know'}</h3><p>{checkIn ? time(checkIn.at) : 'Send a safe check-in to the command-center demo.'}</p></div><button onClick={markSafe}>{checkIn ? 'Update' : 'I’m safe'}</button></section>
          <div className="public-section-title"><h3>Assistance requests</h3><span>{requests.length} total</span></div>
          {requests.map(request => <section className="public-request-card" key={request.id}><div className="public-request-card-top"><HeartHandshake size={21} /><strong>{request.type}</strong><span>{request.people} {request.people === 1 ? 'person' : 'people'}</span></div><div className={`public-request-status is-${request.status}`}><i />{requestStatusLabels[request.status]}</div><small>Requested {time(request.createdAt)}</small>{request.note && <p>{request.note}</p>}{request.unit && <div className="public-unit"><Navigation size={20} /><span><strong>{request.unit}</strong><small>Assigned by the demo operator</small></span></div>}<div className="public-request-meta"><MapPin size={14} />{request.location ? 'Demo location included' : 'Location not shared'}</div>{isOpenRequest(request) && <button className="public-text-button" onClick={() => save(current => updateRequest(current, request.id, 'cancelled', new Date().toISOString()), 'Demo request cancelled.')}>Cancel demo request</button>}<p className="public-request-disclaimer">Demo status only. No real responder has been dispatched.</p></section>)}
          {!requests.length && <div className="public-empty"><HeartHandshake size={30} /><h3>No assistance requests</h3><p>When you request help, operator updates appear here.</p><button onClick={() => go('help')}>Request help<ArrowRight size={15} /></button></div>}
        </>}
        {page === 'account' && <>
          <div className="public-page-title"><span>TANOVIQ / ACCOUNT</span><h2>Your community profile</h2><p>You decide what to share.</p></div>
          <div className="public-profile-card"><span>{profile.initials}</span><h3>{profile.name}</h3><p>Fictional resident · {profile.city}</p><small>{resident.id}</small><div><Accessibility size={14} />PWD{resident.age < 18 && ' · Child'} · Demo profile</div></div>
          <button className="public-nearby-teaser" onClick={() => go('activity')}><ShieldCheck size={24} /><div><strong>My status & requests</strong><p>View check-ins and operator updates.</p></div><ChevronRight size={17} /></button>
          <label className="public-profile-select">Presentation resident<select value={resident.id} onChange={event => changeProfile(event.target.value)}>{publicProfiles.map(item => <option key={item.resident.id} value={item.resident.id}>{item.name} · {item.city}</option>)}</select><small>Switch profiles to demonstrate geographic and group targeting.</small></label>
          <label className="public-setting"><span><MapPin size={20} /><span>Attach demo location<small>Include it in future safe check-ins.</small></span></span><input type="checkbox" role="switch" aria-label="Attach demo location to safe check-ins" checked={shareLocation} onChange={event => { const enabled = event.target.checked; save(current => ({ ...current, preferences: [{ residentId: resident.id, shareLocation: enabled }, ...current.preferences.filter(item => item.residentId !== resident.id)] })); }} /></label>
          <div className="public-privacy"><ShieldCheck size={22} /><h3>Your real location stays private</h3><p>This prototype uses fictional profiles and map positions. It does not request your GPS, or send personal data to a command center.</p></div>
          <div className="public-about"><strong>Presentation mode</strong><p>Sample alerts and locations for demonstrating the workflow. No real messages are sent.</p></div>
        </>}
      </main>
      <nav className="public-bottom-nav" aria-label="Public app navigation">
        <button className={page === 'home' ? 'is-active' : ''} onClick={() => go('home')}><Home size={21} />Home</button>
        <button className={page === 'alerts' ? 'is-active' : ''} onClick={() => go('alerts')}><Bell size={21} />Alerts{unreadCount > 0 && <i />}</button>
        <button className={`public-nav-help${page === 'help' ? ' is-active' : ''}`} onClick={() => go('help')}><span><ShieldCheck size={28} /></span>Get help</button>
        <button className={page === 'nearby' ? 'is-active' : ''} onClick={() => go('nearby')}><MapPin size={21} />Nearby</button>
        <button className={page === 'account' || page === 'activity' ? 'is-active' : ''} onClick={() => go('account')}><UserRound size={21} />Account</button>
      </nav>
    </section>
  </div>;
}
