export interface DispatchPlace {
  id: string; name: string; address: string; label: string;
  lat: number; lng: number; type: string; area: boolean;
}
export async function searchDispatchPlaces(query: string, signal: AbortSignal): Promise<DispatchPlace[]> {
  const response = await fetch('/api/response-places?' + new URLSearchParams({ q: query.trim() }), {
    credentials: 'include', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Place search is unavailable. Try again or pin the location on the map.'); }
  if (!response.ok) throw new Error(data.error || 'Place search could not be completed.');
  if (!Array.isArray(data.places)) throw new Error('Place search returned an unreadable response.');
  return data.places;
}
