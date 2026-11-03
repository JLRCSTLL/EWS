import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { searchDispatchPlaces, type DispatchPlace } from '../../lib/dispatch-places';

export function DispatchPlaceSearch({ onSelect, enabled }: { onSelect: (place: DispatchPlace) => void; enabled: boolean }) {
  const inputId = useId(), resultsId = useId();
  const [query, setQuery] = useState(''), [results, setResults] = useState<DispatchPlace[]>([]);
  const [busy, setBusy] = useState(false), [searched, setSearched] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState<DispatchPlace | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function reset(value: string) {
    request.current?.abort(); setBusy(false); setQuery(value); setResults([]); setSearched(false); setError(''); setSelected(null);
  }
  async function search() {
    if (!enabled || query.trim().length < 2) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setResults([]); setSelected(null); setSearched(false);
    try {
      const places = await searchDispatchPlaces(query, controller.signal);
      if (!controller.signal.aborted) { setResults(places); setSearched(true); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Place search failed.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="dispatch-place-search" role="search" aria-label="Find a dispatch location">
    <label htmlFor={inputId}>Search for a location</label>
    <div className="dispatch-place-bar">
      <Search size={17} aria-hidden="true" />
      <input id={inputId} type="search" maxLength={160} value={query} aria-controls={resultsId} disabled={!enabled}
        placeholder="Mall, hospital, office, building, barangay, city…"
        onChange={e => reset(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!busy) void search(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); reset(query); }
        }} />
      {query && <button type="button" aria-label="Clear location search" onClick={() => reset('')}><X size={15} /></button>}
      <button type="button" className="dispatch-place-submit" onClick={() => void search()} disabled={!enabled || busy || query.trim().length < 2}>
        {busy ? <LoaderCircle size={16} className="dispatch-search-spinner" /> : 'Search'}
      </button>
    </div>
    <small>{enabled ? 'Search across the Philippines. Add a city or province to narrow the results.' : 'Location search is temporarily unavailable. You can still place the pin on the map.'}</small>
    <div id={resultsId} aria-busy={busy}>
      {busy && <p className="dispatch-caption" role="status">Finding matching locations…</p>}
      {error && <p className="dispatch-error" role="alert">{error}</p>}
      {searched && !results.length && <p className="dispatch-caption" role="status">No matching locations. Try another name or add the city. You can also place the pin manually.</p>}
      {!!results.length && <ul className="dispatch-place-results" aria-label="Matching locations">
        {results.map(place => <li key={place.id}><button type="button" onClick={() => {
          request.current?.abort(); setResults([]); setSearched(false); setSelected(place); setQuery(place.name); onSelect(place);
        }}><MapPin size={18} /><span><strong>{place.name}</strong><small>{place.address}</small><em>{place.type}{place.area ? ' · Area location' : ''}</em></span><ArrowUpRight size={16} /></button></li>)}
      </ul>}
      {selected && <p className="dispatch-search-picked" role="status"><MapPin size={14} />{selected.area ? 'Area selected. Move the pin to the exact destination before saving.' : 'Location selected. Check the map pin and entrance before saving.'}</p>}
    </div>
    <a className="dispatch-search-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Place data © OpenStreetMap contributors · Photon</a>
  </div>;
}
