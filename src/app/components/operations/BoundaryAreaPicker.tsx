import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Layers, LoaderCircle, Plus, Search } from 'lucide-react';
import type { AlertGeofence, GeofenceGeometry } from '../../lib/geofencing';
import '../../../styles/boundary-picker.css';
import { childLevels, listPlaceChildren, loadPlaceBoundary, placeKey, placeLevelLabel, resolveBoundaryPlace, type BoundaryPlace, type BoundarySelection, type LocalPlaceLevel } from '../../lib/place-search';

interface Props {
  geometry: GeofenceGeometry;
  areas: AlertGeofence[];
  onSave: (boundaries: BoundarySelection[]) => number | null;
}

export function BoundaryAreaPicker({geometry,areas,onSave}: Props) {
  const [open,setOpen] = useState(false), [scope,setScope] = useState<BoundaryPlace | null>(null);
  const [trail,setTrail] = useState<BoundaryPlace[]>([]), [level,setLevel] = useState<LocalPlaceLevel>('municipality');
  const [query,setQuery] = useState(''), [appliedQuery,setAppliedQuery] = useState('');
  const [places,setPlaces] = useState<BoundaryPlace[]>([]), [selected,setSelected] = useState<Map<string,BoundaryPlace>>(new Map());
  const [nextOffset,setNextOffset] = useState(0), [hasMore,setHasMore] = useState(false);
  const [busy,setBusy] = useState<'list'|'save'|null>(null), [error,setError] = useState(''), [status,setStatus] = useState('');
  const request = useRef<AbortController | null>(null);
  const saveHandler = useRef(onSave);
  saveHandler.current = onSave;
  const savedKeys = new Set(areas.map(area=>area.source?.recordId).filter(Boolean));
  useEffect(()=>()=>request.current?.abort(),[]);

  async function show(parent: BoundaryPlace, type: LocalPlaceLevel, search = '', append = false) {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy('list'); setError(''); setStatus(''); setScope(parent); setLevel(type); setAppliedQuery(search);
    if (!append) {setPlaces([]);setHasMore(false);}
    try {
      const result = await listPlaceChildren(parent,type,search,append ? nextOffset : 0,controller.signal);
      if (controller.signal.aborted) return;
      setPlaces(current => append ? [...new Map([...current,...result.places].map(place=>[placeKey(place),place])).values()] : result.places);
      setNextOffset(result.nextOffset); setHasMore(result.hasMore);
      if (!result.places.length && !append) setStatus('No matching local areas. Try another name or area type.');
    } catch (e) { if(!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load local areas.'); }
    finally {if (!controller.signal.aborted) setBusy(null);}
  }
  async function initialize() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy('list'); setError('');
    try {
      const parent = await resolveBoundaryPlace(geometry,controller.signal);
      if (controller.signal.aborted) return;
      const types = childLevels(parent.level);
      if (!types.length) {setBusy(null);setStatus('This is already an individual barangay.');return;}
      await show(parent,types.includes('municipality') ? 'municipality' : types[0]);
    } catch (e) {if(!controller.signal.aborted) {setBusy(null);setError(e instanceof Error ? e.message : 'Unable to open local areas.');}}
  }
  function toggle(value: boolean) {
    setOpen(value);
    if (!value) {request.current?.abort();setBusy(null);setStatus('');}
    else if (!scope) void initialize();
    else if (!places.length) void show(scope,level,appliedQuery);
  }
  function choose(place: BoundaryPlace) {
    setSelected(current => {const next = new Map(current), key = placeKey(place);if(next.has(key))next.delete(key);else next.set(key,place);return next;});
  }
  function browse(place: BoundaryPlace) {
    if(scope)setTrail(current=>[...current,scope]);
    setQuery('');void show(place,place.level === 'municipality' ? 'barangay' : 'municipality');
  }
  async function save() {
    const selection = [...selected.values()].filter(place=>!savedKeys.has(placeKey(place)));
    if (!selection.length) return;
    request.current?.abort(); const controller = new AbortController();request.current=controller;
    setBusy('save');setError('');setStatus(`Loading boundaries: 0 of ${selection.length}`);
    const loaded: BoundarySelection[] = new Array(selection.length);
    let cursor=0,completed=0;
    try {
      const worker = async () => {
        while(cursor < selection.length) {
          controller.signal.throwIfAborted();
          const index=cursor++,place=selection[index];
          const boundary=await loadPlaceBoundary(place,controller.signal);
          controller.signal.throwIfAborted();loaded[index]={place,geometry:boundary};
          setStatus(`Loading boundaries: ${++completed} of ${selection.length}`);
        }
      };
      await Promise.all([worker(),worker()]);
      if(controller.signal.aborted)return;
      const added = saveHandler.current(loaded);
      if(added === null) {setError('The areas could not be saved. Your selections are retained.');setStatus('');return;}
      setSelected(new Map());setStatus(added ? `${added} individual geofence${added===1?'':'s'} saved.` : 'These areas are already saved.');
    } catch(e) {
      if(!controller.signal.aborted) {controller.abort();setBusy(null);setStatus('');setError(`${e instanceof Error ? e.message : 'Unable to load the selected boundaries.'} No areas were added. Retry when ready.`);}
    } finally {if(!controller.signal.aborted)setBusy(null);}
  }
  const availableSelection=[...selected.keys()].filter(key=>!savedKeys.has(key)).length;
  return <details className="ops-area-picker" open={open} onToggle={event=>{if(event.currentTarget.open!==open)toggle(event.currentTarget.open);}}>
    <summary><Layers size={14}/><span>Choose local areas<small>Save separate municipalities or barangays</small></span><ChevronRight size={14}/></summary>
    <div className="ops-area-picker-body">
      {scope && <>
        <div className="ops-area-scope">{trail.length>0&&<button type="button" aria-label="Back to parent area" disabled={busy==='save'} onClick={()=>{const parent=trail[trail.length-1];setTrail(trail.slice(0,-1));setQuery('');void show(parent,'municipality');}}><ArrowLeft size={14}/></button>}<span><small>WITHIN</small><strong>{scope.label}</strong></span></div>
        <label>Area type<select value={level} disabled={busy==='save'} onChange={event=>{setQuery('');void show(scope,event.target.value as LocalPlaceLevel);}}>{childLevels(scope.level).map(type=><option key={type} value={type}>{type==='municipality'?'Cities / municipalities':type==='barangay'?'Barangays':'Provinces'}</option>)}</select></label>
        <form className="ops-area-filter" onSubmit={event=>{event.preventDefault();void show(scope,level,query);}}><input aria-label="Filter local areas" placeholder="Find a local area…" maxLength={120} value={query} disabled={busy==='save'} onChange={event=>setQuery(event.target.value)}/><button type="submit" aria-label="Search local areas" disabled={!!busy}><Search size={14}/></button></form>
      </>}
      <p className="ops-fence-hint">Each selected area becomes its own saved geofence. Existing areas stay on your map.</p>
      {error&&<div role="alert" className="ops-area-error">{error}<button type="button" onClick={()=>scope?void show(scope,level,appliedQuery):void initialize()}>Retry list</button></div>}
      {busy==='list'&&<p role="status"><LoaderCircle size={13} className="place-search-spinner"/>Loading local areas…</p>}
      {status&&<p role="status">{status}</p>}
      <div className="ops-area-list" aria-label="Local areas">{places.map(place=>{
        const key=placeKey(place),saved=savedKeys.has(key);
        return <div key={key} className={selected.has(key)?'is-selected':''}>
          <label><input type="checkbox" checked={saved||selected.has(key)} disabled={saved||busy==='save'} onChange={()=>choose(place)}/><span><strong>{place.name}</strong><small>{saved?'Already saved': [place.municipality,place.province,placeLevelLabel(place.level)].filter(Boolean).join(' · ')}</small></span></label>
          {childLevels(place.level).length>0&&<button type="button" aria-label={`Browse areas in ${place.label}`} title="Browse smaller areas" disabled={!!busy} onClick={()=>browse(place)}><ChevronRight size={15}/></button>}
        </div>;
      })}</div>
      {hasMore&&<button className="ops-area-more" type="button" disabled={!!busy||!scope} onClick={()=>scope&&void show(scope,level,appliedQuery,true)}>Load more areas</button>}
      <div className="ops-area-save"><span>{availableSelection} selected</span>{availableSelection>0&&<button type="button" disabled={busy==='save'} onClick={()=>setSelected(new Map())}>Clear</button>}<button type="button" disabled={!!busy||!availableSelection} onClick={()=>void save()}>{busy==='save'?<LoaderCircle size={13} className="place-search-spinner"/>:<Plus size={13}/>}Save selected</button></div>
    </div>
  </details>;
}
