import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, CircleCheck, Radio, ShieldAlert, X } from 'lucide-react';
import { useLive } from '../../lib/live-service';
import { commandNotifications, type CommandNotification } from '../../lib/command-notifications';

export function CommandNotifications({ onOpen }: { onOpen:(destination:'public'|'broadcast'|'connected')=>void }) {
  const live = useLive(), userId = live.state?.user.id;
  const approved = live.state && ['admin','operator'].includes(live.state.user.role);
  const items = useMemo(() => commandNotifications(approved ? live.state : null),[live.state,approved]);
  const [open,setOpen] = useState(false), [read,setRead] = useState<string[]>([]), [notice,setNotice] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const key = userId ? `tanoviq-command-notifications:${userId}` : null;
  useEffect(() => {
    setRead([]);setNotice('');setOpen(false);
    if (key) try { const value=JSON.parse(localStorage.getItem(key) || '[]'); if(Array.isArray(value)) setRead(value.filter(i => typeof i === 'string').slice(-1000)); } catch { /* A missing local preference is not an authentication error. */ }
  },[key]);
  useEffect(() => {
    if (!open) return;
    const outside = (event:MouseEvent) => {if (!container.current?.contains(event.target as Node)) setOpen(false);};
    const escape = (event:KeyboardEvent) => {if (event.key === 'Escape') {setOpen(false);container.current?.querySelector('button')?.focus();}};
    document.addEventListener('mousedown',outside);document.addEventListener('keydown',escape);
    return () => {document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const unread = items.filter(item => !read.includes(item.id)).length;
  function mark(ids:string[]) {
    const next = [...new Set([...read,...ids])].slice(-1000);
    setRead(next);
    if (key) try {localStorage.setItem(key,JSON.stringify(next));} catch {setNotice('Read status lasts for this session; local storage is unavailable.');}
  }
  function visit(item:CommandNotification) {mark([item.id]);setOpen(false);onOpen(item.destination);}
  return <div className="command-notifications" ref={container}>
    <button className="ops-icon-button command-notification-button" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} aria-controls="command-notification-list" onClick={() => setOpen(value => !value)}><Bell size={18} />{unread > 0 && <span className="command-notification-count">{unread > 9 ? '9+' : unread}</span>}</button>
    {open && <section className="command-notification-panel" id="command-notification-list" aria-label="Notifications">
      <header><div><h2>Notifications</h2><small>{unread ? `${unread} unread` : 'You’re up to date'}</small></div><button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={16} /></button></header>
      {live.connection !== 'connected' && <p className="command-notification-note" role="status">Connection interrupted. Updates will resume when the service reconnects.</p>}
      {!!items.length && <button className="command-mark-read" disabled={!unread} onClick={() => mark(items.map(item => item.id))}><CheckCheck size={14} />Mark all read</button>}
      {notice && <p className="command-notification-note" role="status">{notice}</p>}
      <div className="command-notification-items">{items.map(item => <button key={item.id} className={read.includes(item.id) ? '' : 'is-unread'} onClick={() => visit(item)}>{item.kind === 'safe' ? <CircleCheck size={17} /> : item.kind === 'request' ? <ShieldAlert size={17} /> : <Radio size={17} />}<span><strong>{item.title}</strong><small>{item.detail}</small><time dateTime={item.at}>{new Date(item.at).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></span>{!read.includes(item.id) && <i aria-label="Unread" />}</button>)}</div>
      {!items.length && <div className="command-notification-empty"><Bell size={27} /><strong>{approved ? 'No notifications yet' : 'Sign in to view updates'}</strong><p>{approved ? 'Field requests, safe check-ins, and broadcasts will appear here.' : 'Use an approved operator account to receive command-center updates.'}</p>{!approved && <button onClick={() => {setOpen(false);onOpen('connected');}}>Open Personnel</button>}</div>}
      <footer>Read status is saved on this workstation. Reading here does not acknowledge an alert on a personnel device.</footer>
    </section>}
  </div>;
}
