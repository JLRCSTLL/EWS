import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { boundarySourceUrl, loadPlaceBoundary, searchPlaces, type BoundaryPlace, type PlaceLevel } from '../../lib/place-search';
import type { GeofenceGeometry } from '../../lib/geofencing';

export function PlaceSearch({ onPreview, onClear }: { onPreview:(place:BoundaryPlace,geometry:GeofenceGeometry)=>void; onClear:()=>void }) {
  const [query,setQuery] = useState(''), [level,setLevel] = useState<PlaceLevel | 'all'>('all');
  const [results,setResults] = useState<BoundaryPlace[]>([]), [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [note,setNote] = useState('');
  const [selected,setSelected] = useState<BoundaryPlace | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function cancel() {request.current?.abort();setBusy(false);}
  async function choose(place: BoundaryPlace, controller = new AbortController()) {
    request.current?.abort(); request.current = controller;
    setBusy(true);setError('');
    try {
      const geometry = await loadPlaceBoundary(place,controller.signal);
      if (controller.signal.aborted) return;
      setSelected(place);setQuery(place.label);setOpen(false);onPreview(place,geometry);
    } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to show this boundary.'); }
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  async function search() {
    cancel(); const controller = new AbortController(); request.current = controller;
    setOpen(true);setBusy(true);setSelected(null);setError('');setNote('');setResults([]);
    try {
      const result = await searchPlaces(query,level,controller.signal);
      if (controller.signal.aborted) return;
      setResults(result.places);
      setNote(result.partial ? 'Some boundary levels are unavailable. You can retry or choose a result below.' : result.places.length ? 'Choose a place to outline its boundary.' : 'No matching area. Try its name with a municipality or province, or change the area type.');
      if (result.places.length === 1 && !result.partial) await choose(result.places[0]);
    } catch(e) {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed.');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <div className="place-search">
    <form className="place-search-bar" role="search" onSubmit={e => {e.preventDefault();void search();}}>
      {busy ? <LoaderCircle className="place-search-spinner" size={16} /> : <Search size={16} />}
      <input id="operations-place-search" type="search" maxLength={120} aria-label="Search Philippine places" placeholder="Search barangay, municipality, province…" value={query} onChange={e => {cancel();setQuery(e.target.value);setSelected(null);setResults([]);setError('');setNote('');}} onFocus={() => {if(results.length || error) setOpen(true);}} onKeyDown={e => {if(e.key === 'Escape') {cancel();setOpen(false);}}} />
      {query && <button type="button" aria-label="Clear place search" onClick={() => {cancel();setQuery('');setSelected(null);setResults([]);setOpen(false);setError('');onClear();}}><X size={14} /></button>}
      <button type="submit" aria-label="Search boundaries" disabled={busy || query.trim().length < 2}><ArrowRight size={17} /></button>
    </form>
    {open && <section className="place-search-results" aria-label="Place search results">
      <div className="place-search-filter"><select aria-label="Place type" value={level} onChange={e => {cancel();setLevel(e.target.value as PlaceLevel | 'all');setResults([]);setNote('Press Search to find this area type.');}}><option value="all">All area types</option><option value="barangay">Barangay</option><option value="municipality">City / municipality</option><option value="province">Province</option></select><button type="button" aria-label="Collapse search results" onClick={() => setOpen(false)}><X size={15} /></button></div>
      {error && <p role="alert">{error}</p>}{busy && <p role="status">{results.length ? 'Loading boundary…' : 'Searching Philippine places…'}</p>}{!busy && note && <p role="status">{note}</p>}
      <div className="place-search-list">{results.map(place => <button type="button" key={`${place.level}-${place.id}`} disabled={busy} onClick={() => void choose(place)}><MapPin size={17} /><span><strong>{place.name}</strong><small>{[place.level === 'municipality' ? 'City / municipality' : place.level,place.municipality,place.province].filter(Boolean).join(' · ')}</small></span><ArrowRight size={14} /></button>)}</div>
      <a href={boundarySourceUrl} target="_blank" rel="noreferrer">Boundary data: GEODATA · indicative boundaries</a>
    </section>}
    {selected && !open && <span className="place-search-selected"><Check size={11} />{selected.level === 'municipality' ? 'City / municipality' : selected.level} boundary shown</span>}
  </div>;
}
