import { useEffect, useState } from 'react';
import { Hospital, LocateFixed, Tent, Trash2 } from 'lucide-react';
import { api, useLive } from '../../lib/live-service';
import type { ResponseFacility, ResponsePoint } from '../../lib/response';

export function ResponseDirectory({onLocate, onDelete}: {onLocate?: (point: ResponsePoint) => void; onDelete: (id: string) => void}) {
  const live = useLive();
  const ready = !!live.state?.hospitalDirectoryReady;
  const [query, setQuery] = useState(''), [kind, setKind] = useState(''), [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ facilities: ResponseFacility[]; total: number; limit: number; catalog?: {snapshotDate: string; count: number} } | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(''), [busy, setBusy] = useState(false);
  const custom = live.state?.responseFacilities || [];
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({q:query, kind, offset:String(offset)});
      void api('/response-facilities?' + params).then(data => { if (active) setResult(data); }).catch(e => { if (active) { setResult(null); setError(e.message); } }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [ready, query, kind, offset, revision, custom.length]);
  const fallback = custom.filter(f => (!kind || f.kind === kind) && f.name.toLowerCase().includes(query.toLowerCase()));
  const rows = ready ? result?.facilities || [] : fallback.slice(offset, offset + 30);
  const total = ready ? result?.total || 0 : fallback.length, limit = result?.limit || 30;
  return <section className="hospital-directory" aria-label="Saved destination directory">
    <div className="hospital-directory-search"><label>Search saved destinations<input type="search" maxLength={100} placeholder="Hospital name, city or address…" value={query} onChange={e => {setQuery(e.target.value); setOffset(0); setDeleting('');}} /></label><label>Type<select value={kind} onChange={e => {setKind(e.target.value); setOffset(0); setDeleting('');}}><option value="">All destinations</option><option value="hospital">Hospitals</option><option value="base">Response bases</option></select></label></div>
    {result?.catalog && <p className="dispatch-caption">Philippine hospital catalog · {result.catalog.count.toLocaleString()} mapped entries · {result.catalog.snapshotDate}. © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> / <a href="https://data.humdata.org/dataset/philippines-healthsites" target="_blank" rel="noreferrer">Healthsites</a> · ODbL. Listings and vehicle entrances require local verification.</p>}
    {!ready && <p className="dispatch-caption">Showing operator-saved destinations. The Philippine catalog will appear after the connected service is updated.</p>}
    {error && <p className="dispatch-error" role="alert">{error} <button onClick={() => setRevision(v => v + 1)}>Retry directory</button></p>}
    {loading && <p role="status">Searching saved destinations…</p>}
    <div className="dispatch-facilities" aria-busy={loading}>{rows.map(f => <div key={f.id} className="dispatch-facility">
      {f.kind === 'base' ? <Tent size={18}/> : <Hospital size={18}/>}
      <span className="dispatch-facility-info"><strong>{f.name}</strong><small>{f.source_data?.address || `${f.location.lat.toFixed(5)}, ${f.location.lng.toFixed(5)}`}</small><small>{f.source_ref ? 'Mapped hospital · receiving capability unverified' : `${f.kind} · operator directory`}</small>{f.source_data?.sourceUrl && <a href={f.source_data.sourceUrl} target="_blank" rel="noreferrer">View map source</a>}</span>
      {onLocate && <button type="button" className="dispatch-facility-delete" onClick={() => onLocate(f.location)} aria-label={`Locate ${f.name}`}><LocateFixed size={15}/>Locate</button>}
      <button type="button" className="dispatch-facility-delete" aria-label={`Delete ${f.name}`} disabled={busy || !live.state?.responseDirectoryDeleteReady} onClick={() => {setDeleting(f.id); setError('');}}><Trash2 size={15}/>Delete</button>
      {deleting === f.id && <div className="dispatch-delete-confirm" role="group" aria-label={`Confirm deletion of ${f.name}`}><p>Delete <strong>{f.name}</strong> from the directory? Existing dispatches keep their destination. Removed catalog entries stay deleted after restarts.</p><div><button className="dispatch-danger" disabled={busy} onClick={async () => {setBusy(true);setError('');try {await live.mutate(`/response-facilities/${f.id}`,{},'DELETE');onDelete(f.id);setDeleting('');if(rows.length===1&&offset>0)setOffset(Math.max(0,offset-limit));else setRevision(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Unable to delete destination.');}finally{setBusy(false);}}}>{busy?'Deleting…':'Confirm delete'}</button><button disabled={busy} onClick={() => setDeleting('')}>Keep entry</button></div></div>}
    </div>)}</div>
    {!loading && !error && !total && <p className="dispatch-caption">No matching saved destinations. Try another name or add a destination below.</p>}
    <nav className="hospital-directory-pages" aria-label="Directory pages"><span>{total ? `${offset + 1}–${Math.min(offset + limit,total)} of ${total.toLocaleString()}` : '0 results'}</span><button disabled={loading || offset===0} onClick={() => setOffset(v=>Math.max(0,v-limit))}>Previous</button><button disabled={loading || offset+limit>=total} onClick={() => setOffset(v=>v+limit)}>Next</button></nav>
  </section>;
}
