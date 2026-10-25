import { useEffect, useState } from 'react';
import { Download, History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { api, ApiError, useLive } from '../../lib/live-service';
import type { AuditLogEntry } from '../../lib/dashboard-data';
import { activityCsv, logCategories, type ActivityEntry, type ActivityPage, type LogCategory } from '../../lib/activity-log';

const time = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const sinceFor = (days: string) => days === 'all' ? '' : new Date(Date.now() - Number(days) * 86400000).toISOString();

export function ActivityLog({ demoLogs, liveMode, onSignIn }: { demoLogs: AuditLogEntry[]; liveMode: boolean; onSignIn: () => void }) {
  const live = useLive();
  const user = live.state?.user;
  const approved = user?.role === 'admin' || user?.role === 'operator';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LogCategory>('all');
  const [period, setPeriod] = useState('all');
  const [since, setSince] = useState('');
  const [cursors, setCursors] = useState<string[]>(['']);
  const [page, setPage] = useState<ActivityPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [updatedAt, setUpdatedAt] = useState('');
  const cursor = cursors.at(-1) || '';
  const reset = () => { setCursors(['']); setPage(null); setError(''); };

  useEffect(() => {
    if (!liveMode || !approved) return;
    let active = true, pending = false;
    setBusy(true); setPage(null); setError(''); setUpdatedAt('');
    const load = async () => {
      if (!active || pending) return;
      pending = true;
      try {
        const params = new URLSearchParams({ q: query.trim(), category, since, cursor });
        const result: ActivityPage = await api(`/audit?${params}`);
        if (active) { setPage(result); setError(''); setUpdatedAt(new Date().toISOString()); }
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setPage(null);
          setError(err instanceof ApiError && err.status === 404 ? 'Logs are not available on this service version yet. Deploy the updated backend to enable them.' : err instanceof Error ? err.message : 'Could not load logs. Try refreshing.');
        }
      } finally { pending = false; if (active) setBusy(false); }
    };
    const start = window.setTimeout(() => void load(), 250);
    const interval = cursor ? undefined : window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { active = false; clearTimeout(start); clearInterval(interval); };
  }, [liveMode, approved, user?.id, query, category, since, cursor, refresh]);

  if (liveMode && !approved) return <section className="activity-empty">
    <ShieldCheck size={30} /><h3>{user ? 'Operator access required' : 'Sign in to view logs'}</h3>
    <p>Activity logs are available to approved command-center operators and administrators.</p>
    <button className="ops-secondary-button" onClick={onSignIn}>Open personnel &amp; access</button>
  </section>;

  const demoEntries: ActivityEntry[] = liveMode ? [] : demoLogs.map<ActivityEntry>(log => ({
    id: log.id, action: log.action, actor: log.user, target: log.details, createdAt: log.createdAt, reference: null,
    category: log.type === 'access' || log.type === 'user' ? 'access' : 'operations',
  })).filter(entry => (category === 'all' || entry.category === category) && (!since || Date.parse(entry.createdAt) >= Date.parse(since)) && `${entry.action} ${entry.actor} ${entry.target}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const entries = liveMode ? page?.entries || [] : demoEntries;
  const exportPage = () => {
    const url = URL.createObjectURL(new Blob([activityCsv(entries)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `TANOVIQ-${liveMode ? 'activity' : 'demo'}-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="activity-log" aria-label="Command-center activity logs">
    <div className="activity-status">
      <div><History size={17} /><span>{liveMode ? 'Recorded operations' : 'Demo activity'}<small>{liveMode ? cursor ? 'Browsing older entries · refresh to return to latest' : 'Updates every 15 seconds' : 'Sample events and actions from this browser only'}</small></span></div>
      <div className="activity-actions"><button className="ops-secondary-button" disabled={!entries.length || busy} onClick={exportPage}><Download size={14} />Export shown</button>
        {liveMode && <button className="ops-secondary-button" disabled={busy} onClick={() => { reset(); setSince(sinceFor(period)); setRefresh(value => value + 1); }}><RefreshCw size={14} />Refresh</button>}</div>
    </div>
    <div className="activity-filters">
      <label className="activity-search"><Search size={16} /><input type="search" aria-label="Search activity logs" placeholder="Search event, preferred name, or record…" maxLength={100} value={query} onChange={event => { setQuery(event.target.value); reset(); }} /></label>
      <label><span>Event type</span><select value={category} onChange={event => { setCategory(event.target.value as LogCategory); reset(); }}>{Object.entries(logCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label><span>Time period</span><select value={period} onChange={event => { setPeriod(event.target.value); setSince(sinceFor(event.target.value)); reset(); }}><option value="all">All time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
    </div>
    {error && <p className="activity-error" role="alert">{error}{page && ' Displayed entries may be out of date.'}</p>}
    <div className="activity-table" aria-busy={busy}>
      {entries.length ? <table><caption className="sr-only">Recorded events, newest first. Times are Philippine time.</caption><thead><tr><th scope="col">Time · PHT</th><th scope="col">Event / record</th><th scope="col">Operator / actor</th><th scope="col">Type</th></tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.id}><td><time dateTime={entry.createdAt}>{time.format(new Date(entry.createdAt))}</time></td><td><strong>{entry.action}</strong>{entry.target && <span>{entry.target}</span>}{entry.reference && <small>Ref {entry.reference.slice(0, 8)}</small>}</td><td>{entry.actor}</td><td><span className={`activity-category activity-category--${entry.category}`}>{logCategories[entry.category]}</span></td></tr>)}</tbody></table>
        : <div className="activity-empty" role="status"><History size={26} /><h3>{busy ? 'Loading activity…' : error ? 'Logs could not be loaded' : query || category !== 'all' || since ? 'No matching events' : 'No recorded activity yet'}</h3><p>{busy ? 'Retrieving recorded operations.' : error ? 'Use Refresh to try again.' : 'Broadcasts, group changes, access decisions, and assistance updates appear here.'}</p></div>}
    </div>
    <div className="activity-footer"><span aria-live="polite">{entries.length} events shown{liveMode && cursors.length > 1 ? ` · Page ${cursors.length}` : ''}{updatedAt && liveMode ? ` · Checked ${time.format(new Date(updatedAt))}` : ''}</span>
      {liveMode && <div><button className="ops-secondary-button" disabled={busy || cursors.length <= 1} onClick={() => { setPage(null); setCursors(values => values.slice(0, -1)); }}>Newer</button><button className="ops-secondary-button" disabled={busy || !page?.nextCursor} onClick={() => { if (page?.nextCursor) { setCursors(values => [...values, page.nextCursor!]); setPage(null); } }}>Older</button></div>}
    </div>
    <p className="activity-note">{liveMode ? 'Shared service history. Record labels reflect their current names. Logs exclude contact details, precise locations, and message contents.' : 'Demo events are separate from the shared service history.'}</p>
  </section>;
}
