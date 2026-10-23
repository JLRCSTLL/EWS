import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, Bell, Check, CheckCheck, ChevronRight, HeartHandshake, Home, LocateFixed, LogOut, MapPin, RefreshCw, ShieldCheck, UserRound, Wifi, WifiOff } from 'lucide-react';
import { api, useLive } from '../../lib/live-service';
import { openRequest, type LiveAlert } from '../../lib/live-model';
import { AuthPanel } from './AuthPanel';
import { LocationMap } from './LocationMap';
import { AlertAlarm } from './AlertAlarm';
import { isAndroidApp } from '../../lib/android';
import '../../../styles/live-app.css';

const pages = ['home','alerts','help','map','account'] as const;
type Page = typeof pages[number];
const currentPage = (): Page => { const part = location.hash.split('/')[2]; return pages.includes(part as Page) ? part as Page : 'home'; };
const at = (date: string | null | undefined) => date ? new Date(date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : 'Not yet shared';

function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null), [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(() => matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', ready); window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done); };
  }, []);
  if (installed || isAndroidApp()) return null;
  return <><button className="el-install" onClick={async () => { if (prompt) { await prompt.prompt(); setPrompt(null); } else setHelp(value => !value); }}><ArrowDownToLine size={17} /><span>Keep E-Ligtas close<small>Add to your home screen</small></span><ChevronRight size={17} /></button>{help && <p className="el-notice">On iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android, open your browser menu and choose Install app or Add to Home screen.</p>}</>;
}

function PushSettings() {
  const [enabled, setEnabled] = useState(false), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { if ('serviceWorker' in navigator && 'PushManager' in window) navigator.serviceWorker.getRegistration().then(w => w?.pushManager.getSubscription()).then(s => setEnabled(!!s)); }, []);
  async function toggle() {
    setBusy(true); setNote('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('For iPhone notifications, first add E-Ligtas to your Home Screen and open it there. Your inbox works while this page is open.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications are blocked. You can allow them in browser settings. Your inbox still works.');
      const worker = await navigator.serviceWorker.ready;
      const existing = await worker.pushManager.getSubscription();
      if (existing && enabled) { await api('/push', { endpoint: existing.endpoint }, 'DELETE'); await existing.unsubscribe(); setEnabled(false); setNote('Device notifications are off.'); return; }
      const { pushPublicKey } = await api('/config');
      if (!pushPublicKey) throw new Error('Push notifications are not configured on this deployment.');
      const raw = atob(pushPublicKey.replace(/-/g,'+').replace(/_/g,'/'));
      const key = Uint8Array.from(raw, c => c.charCodeAt(0));
      const subscription = existing || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api('/push', subscription.toJSON()); setEnabled(true); setNote('Notifications enabled on this device.');
    } catch (error) { setNote(error instanceof Error ? error.message : 'Unable to enable notifications.'); }
    finally { setBusy(false); }
  }
  if (isAndroidApp()) return null;
  return <div className="el-setting"><div><Bell size={19} /><span><strong>Device notifications</strong><small>Show alerts when the app is closed, where supported. Sound follows your device settings.</small></span></div><button className="el-secondary" disabled={busy} onClick={toggle}>{busy ? 'Please wait…' : enabled ? 'Turn off' : 'Enable'}</button>{note && <p className="el-notice" role="status">{note}</p>}</div>;
}

function ProfileForm() {
  const { state, mutate } = useLive();
  const user = state!.user;
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState(user.groups);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const fields = new FormData(event.currentTarget);
    try { await mutate('/profile', { name: fields.get('name'), municipality: fields.get('municipality'), groups, alertsEnabled: fields.get('alerts') === 'on' }, 'PUT'); setNotice('Profile saved.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save profile.'); }
    finally { setBusy(false); }
  }
  return <form className="el-profile-form" onSubmit={save}><label>Full name<input name="name" defaultValue={user.name} minLength={2} maxLength={80} required /></label><label>City / municipality<input name="municipality" defaultValue={user.municipality} maxLength={80} placeholder="e.g. Cainta, Rizal" /></label>
    <fieldset><legend>Priority groups <span>Optional</span></legend><p>Self-reported information helps your command center target assistance.</p><div className="el-group-options">{[['pwd','Person with disability'],['children','Under 18'],['seniors','60 years or older'],['pregnant','Pregnant'],['responders','Responder']].map(([id,label]) => <label key={id}><input type="checkbox" checked={groups.includes(id)} onChange={e => setGroups(current => e.target.checked ? [...current.filter(g => !(id === 'children' && g === 'seniors') && !(id === 'seniors' && g === 'children')),id] : current.filter(g => g !== id))} />{label}</label>)}</div></fieldset>
    <label className="el-check"><input type="checkbox" name="alerts" defaultChecked={user.alertsEnabled} />Receive new command-center alerts</label><button className="el-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>{notice && <p role="status" className="el-notice">{notice}</p>}
  </form>;
}

export default function LivePublicApp() {
  const live = useLive();
  const { state, connection, initialized, recoveryCode } = live;
  const [page, setPage] = useState<Page>(currentPage), [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [search, setSearch] = useState('');
  const receipts = useRef(new Set<string>());
  useEffect(() => { receipts.current.clear(); }, [state?.user.id]);
  useEffect(() => {
    const route = () => { setPage(currentPage()); setSelected(null); setNotice(''); window.scrollTo(0,0); };
    window.addEventListener('hashchange',route); document.title = 'E-Ligtas · Community safety';
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'); const previous = meta?.content;
    if (meta) meta.content = '#f5f7fb';
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => { window.removeEventListener('hashchange',route); if (meta && previous) meta.content = previous; };
  }, []);
  useEffect(() => {
    if (!state || connection !== 'connected') return;
    const unseen = state.alerts.filter(a => !a.received_at && !receipts.current.has(a.id));
    if (!unseen.length) return;
    for (const alert of unseen) receipts.current.add(alert.id);
    void Promise.all(unseen.map(alert => api(`/alerts/${alert.id}/receipt`, { read: false }).catch(() => { receipts.current.delete(alert.id); }))).then(live.refresh);
  }, [state?.alerts,connection]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true); setNotice('');
    try { await fn(); setNotice(message); } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const user = state?.user, alerts = state?.alerts || [], requests = state?.requests || [];
  const unread = alerts.filter(a => !a.read_at).length;
  const currentRequest = requests.find(openRequest);
  const chosen = alerts.find(a => a.id === selected);
  const connected = connection === 'connected';
  const openAlert = (alert: LiveAlert) => { if (page !== 'alerts') { location.hash = '#/public/alerts'; setTimeout(() => setSelected(alert.id),0); } else setSelected(alert.id); };
  const locationCard = user && <section className="el-card el-location-card"><div className="el-section-heading"><span className="el-icon-soft"><LocateFixed size={21} /></span><div><h2>Your location</h2><p>{user.locationSharing ? 'Visible to approved operators' : 'Only shared with your permission'}</p></div></div><p className="el-location-status">{live.locationStatus}</p>{user.location && <p className="el-caption">Last received {at(user.location.updatedAt)} · ±{Math.round(user.location.accuracy)} m</p>}<button className={live.sharingOnDevice ? 'el-secondary' : 'el-primary'} disabled={busy} onClick={() => live.sharingOnDevice ? void action(live.stopLocation,'Location sharing stopped.') : void action(live.startLocation,'Location sharing started.')}>{live.sharingOnDevice ? 'Stop sharing location' : 'Share my location'}<LocateFixed size={17} /></button>{!live.sharingOnDevice && user.locationSharing && <button className="el-text-button" disabled={busy} onClick={() => void action(live.stopLocation,'Saved location removed.')}>Remove shared location</button>}<p className="el-caption">{isAndroidApp() ? "Your location is shared with approved operators as fresh GPS fixes arrive (target: every second), including while the screen is locked. Android shows a sharing notification with a Stop sharing button. GPS, internet, and device battery settings can affect updates." : "GPS updates while this page is open. Switching apps or locking your phone may pause sharing. Use the Android app for continuous sharing."} Stopping sharing removes your saved point.</p></section>;
  const alertCard = (alert: LiveAlert) => <button key={alert.id} className={`el-alert-card priority-${alert.priority}`} onClick={() => { if (page !== 'alerts') { location.hash = '#/public/alerts'; setTimeout(() => setSelected(alert.id),0); } else setSelected(alert.id); }}><span className="el-alert-icon"><Bell size={20} /></span><span><span className="el-alert-meta">{alert.priority} priority · {at(alert.created_at)}{!alert.read_at && <i aria-label="Unread" />}</span><strong>{alert.area.name}</strong><p>{alert.content}</p></span><ChevronRight size={17} /></button>;
  return <div className="el-app"><a className="el-skip" href="#public-main" onClick={e => { e.preventDefault(); document.getElementById('public-main')?.focus(); }}>Skip to content</a><header className="el-header"><a href="#/public" className="el-brand"><span className="el-logo"><ShieldCheck size={26} /></span><span>E-Ligtas<small>COMMUNITY SAFETY</small></span></a><div className={`el-connection ${connected ? 'is-connected' : ''}`} role="status">{connected ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{connected ? 'Connected' : connection === 'connecting' ? 'Connecting' : 'Reconnecting'}</span></div>{user && <a href="#/public/account" className="el-avatar" aria-label="Your account">{user.name.charAt(0).toUpperCase()}</a>}</header>
    <main id="public-main" className="el-main" tabIndex={-1}>
      {!connected && initialized && <div className="el-notice el-connection-error" role="status"><WifiOff size={19} /><span>{live.error || 'You are offline. Updates will resume when connected.'} {state ? 'Showing the last saved update.' : ''}</span><button onClick={() => void live.refresh()} aria-label="Retry connection"><RefreshCw size={18} /></button></div>}
      {!initialized ? <p className="el-loading">Connecting to your community…</p> : !user || recoveryCode ? <><AuthPanel /><InstallApp /><p className="el-pilot-note">E-Ligtas pilot · independently developed; not an official eGovPH service.</p></> : <>
        <AlertAlarm key={user.id} userId={user.id} alerts={alerts} onOpen={openAlert} settings={page === 'account'} />
        {notice && <div className="el-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
        {page === 'home' && <><div className="el-greeting"><span className="el-eyebrow">MABUHAY, {user.name.split(' ')[0].toUpperCase()}</span><h1>A little more<br />peace of mind.</h1><p><MapPin size={15} />{user.municipality || 'Set your community in your profile'}</p></div><div className="el-home-grid"><section className="el-hero"><div><span className="el-eyebrow">YOUR ALERT INBOX</span><h2>{unread ? `${unread} new ${unread === 1 ? 'alert' : 'alerts'} for you` : 'Stay informed. Stay ready.'}</h2><p>{unread ? 'Your command center has an update. Take a moment to read it.' : 'Messages for your area appear here when your command center sends them.'}</p><a href="#/public/alerts">Open my alerts <ArrowRight size={18} /></a></div><ShieldCheck size={92} strokeWidth={1} aria-hidden="true" /></section>{locationCard}</div>
          <div className="el-quick-actions"><button disabled={busy || !connected} onClick={() => void action(() => live.mutate('/safe',{}),'Your safe check-in was sent to the command center.')}><span className="el-quick-icon safe"><CheckCheck size={23} /></span><strong>I’m safe</strong><small>Send a check-in</small></button><a href="#/public/help"><span className="el-quick-icon help"><HeartHandshake size={23} /></span><strong>Request help</strong><small>Contact your center</small></a><a href="#/public/map"><span className="el-quick-icon map"><MapPin size={23} /></span><strong>My area</strong><small>Location & alert zones</small></a></div>
          <div className="el-section-title"><h2>Latest updates</h2><a href="#/public/alerts">View all <ArrowRight size={15} /></a></div>{alerts.length ? alerts.slice(0,2).map(alertCard) : <div className="el-empty"><Bell size={25} /><strong>No alerts yet</strong><p>Enable location sharing to receive geofenced messages for your area.</p></div>}{currentRequest && <a className="el-request-summary" href="#/public/help"><HeartHandshake size={20} /><span><strong>{currentRequest.type}</strong><small>{currentRequest.status} {currentRequest.assigned_unit && `· ${currentRequest.assigned_unit}`}</small></span><ChevronRight size={17} /></a>}<InstallApp /></>}
        {page === 'alerts' && <><div className="el-page-heading"><span className="el-eyebrow">FROM YOUR COMMAND CENTER</span><h1>Your alerts</h1><p>{unread} unread · messages addressed to your account</p></div>{chosen ? <article className="el-card el-alert-detail"><button className="el-text-button" onClick={() => setSelected(null)}>← All alerts</button><span className={`el-priority priority-${chosen.priority}`}>{chosen.priority} priority</span><h2>{chosen.area.name}</h2><time>{at(chosen.created_at)}</time><p className="el-message-body">{chosen.content}</p><button className="el-primary" disabled={busy || !!chosen.read_at} onClick={() => void action(() => live.mutate(`/alerts/${chosen.id}/receipt`,{ read: true }),'The command center can see that you read this alert.')}><CheckCheck size={18} />{chosen.read_at ? 'Acknowledged' : 'I have read this alert'}</button><a className="el-secondary" href="#/public/help">Request assistance <ArrowRight size={17} /></a><LocationMap location={user.location} areas={[chosen.area]} /></article> : <><label className="el-search"><span>Search alerts</span><input type="search" placeholder="Search message or area" value={search} onChange={e => setSearch(e.target.value)} /></label>{alerts.filter(a => `${a.content} ${a.area.name}`.toLowerCase().includes(search.toLowerCase())).map(alertCard)}{!alerts.filter(a => `${a.content} ${a.area.name}`.toLowerCase().includes(search.toLowerCase())).length && <div className="el-empty"><Bell size={28} /><strong>{search ? 'No matching alerts' : 'Your inbox is clear'}</strong><p>New messages appear automatically while you are connected.</p></div>}</>}</>}
        {page === 'map' && <><div className="el-page-heading"><span className="el-eyebrow">LOCATION & EXPOSURE</span><h1>Your area</h1><p>See the location you shared and the boundaries of alerts sent to you.</p></div><LocationMap location={user.location} areas={[...new Map(alerts.map(a => [a.area.id,a.area])).values()]} />{!user.location && <p className="el-notice">You haven’t shared a location. The map shows a regional overview.</p>}{locationCard}</>}
        {page === 'help' && <><div className="el-page-heading"><span className="el-eyebrow">WE’RE CONNECTED</span><h1>How can we help?</h1><p>Send a request to your connected command center and follow its status here.</p></div><p className="el-notice">Pilot service for testing and presentations. A submitted request does not mean a team has been dispatched.</p>{currentRequest ? <section className="el-card el-request-detail"><span className="el-priority">{currentRequest.status}</span><h2>{currentRequest.type}</h2><p>{currentRequest.people} {currentRequest.people === 1 ? 'person needs' : 'people need'} assistance</p><p>{currentRequest.note}</p><ol className="el-request-steps">{['new','acknowledged','assigned'].map((step,i) => <li key={step} className={['new','acknowledged','assigned'].indexOf(currentRequest.status) >= i ? 'is-done' : ''}><Check size={14} />{step === 'new' ? 'Request received' : step === 'acknowledged' ? 'Reviewed by command center' : 'Response team assigned'}</li>)}</ol>{currentRequest.assigned_unit && <p className="el-notice">Assigned team: <strong>{currentRequest.assigned_unit}</strong></p>}<p className="el-caption">Updated {at(currentRequest.updated_at)}</p><button className="el-secondary" disabled={busy} onClick={() => void action(() => live.mutate(`/requests/${currentRequest.id}`,{ status: 'cancelled' },'PATCH'),'Request cancelled.')}>Cancel request</button></section> : <form className="el-card el-help-form" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void action(() => live.mutate('/requests',{ id: crypto.randomUUID(),type: fields.get('type'),people: Number(fields.get('people')),note: fields.get('note'),includeLocation: fields.get('includeLocation') === 'on' }),'Your request was received. Follow its status here.'); }}><label>Assistance needed<select name="type"><option>Evacuation</option><option>Medical assistance</option><option>Rescue</option><option>Other assistance</option></select></label><label>People needing assistance<input name="people" type="number" min={1} max={20} defaultValue={1} required /></label><label>What should the team know?<textarea name="note" maxLength={500} rows={4} placeholder="Describe your situation and a nearby landmark." /></label><label className="el-check"><input name="includeLocation" type="checkbox" disabled={!user.locationSharing} defaultChecked={user.locationSharing} />Attach my shared location</label><p className="el-caption">{user.locationSharing ? 'The team can see your latest shared location while sharing stays on.' : 'Turn on location sharing first, or include a landmark in your message.'}</p><button className="el-primary" disabled={busy || !connected}>{busy ? 'Sending…' : 'Send assistance request'}<ArrowRight size={18} /></button></form>}{requests.filter(r => !openRequest(r)).length > 0 && <section className="el-card"><h2>Previous requests</h2>{requests.filter(r => !openRequest(r)).map(r => <div key={r.id} className="el-history-row"><strong>{r.type}</strong><span>{r.status}</span><small>{at(r.updated_at)}</small></div>)}</section>}</>}
        {page === 'account' && <><div className="el-page-heading"><span className="el-eyebrow">YOUR E-LIGTAS</span><h1>Account & privacy</h1><p>@{user.username} · {user.role}</p></div><section className="el-card"><h2>Your profile</h2><ProfileForm key={user.id} /></section>{locationCard}<section className="el-card"><h2>Stay connected</h2><PushSettings /><InstallApp /></section><section className="el-card"><h2>Command-center access</h2><p>Only approved operators can see residents’ shared locations and send alerts.</p>{user.role === 'resident' ? <button className="el-secondary" disabled={busy || user.operatorRequested} onClick={() => void action(() => live.mutate('/operator/request',{}),'Access requested. The account owner must approve your registration.')}>{user.operatorRequested ? 'Approval pending' : 'Request operator access'}</button> : <a className="el-primary" href="#/command">Open command center<ArrowRight size={17} /></a>}</section><button className="el-signout" disabled={busy} onClick={() => void action(live.logout,'Signed out.')}><LogOut size={18} />Sign out</button><p className="el-pilot-note">Your precise location is visible only to approved command-center operators while sharing is enabled. E-Ligtas pilot · not an official eGovPH service.</p></>}
      </>}
    </main>{user && !recoveryCode && <nav className="el-bottom-nav" aria-label="Public app navigation">{[[Home,'home','Home'],[Bell,'alerts','Alerts'],[HeartHandshake,'help','Get help'],[MapPin,'map','My area'],[UserRound,'account','Account']].map(([Icon,id,label]: any) => <a key={id} href={`#/public/${id === 'home' ? '' : id}`} className={page === id ? 'is-active' : ''} aria-current={page === id ? 'page' : undefined}><Icon size={22} strokeWidth={page === id ? 2.2 : 1.7} /><span>{label}</span>{id === 'alerts' && unread > 0 && <i>{unread}</i>}</a>)}</nav>}
  </div>;
}
