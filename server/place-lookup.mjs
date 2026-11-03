const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
export function placeQuery(value) {
  if (typeof value !== 'string') fail(400, 'Enter a place name to search.');
  const query = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 160 || /[\u0000-\u001f]/.test(query))
    fail(400, 'Enter a place name between 2 and 160 characters.');
  return query;
}
export function photonPlaces(data) {
  if (!Array.isArray(data?.features)) fail(503, 'Place search returned an unreadable response. Try again.');
  const seen = new Set(), places = [];
  for (const feature of data.features.slice(0, 50)) {
    const p = feature?.properties, coordinates = feature?.geometry?.coordinates;
    if (!p || feature.geometry?.type !== 'Point' || !Array.isArray(coordinates) || clean(p.countrycode, 2).toUpperCase() !== 'PH') continue;
    const [lng, lat] = coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
    const name = clean(p.name || p.street, 120);
    if (!name) continue;
    const parts = [...new Set([name, [p.housenumber, p.street].filter(Boolean).join(' '), p.district, p.city, p.county, p.state].map(value => clean(value, 120)).filter(Boolean))];
    const address = parts.join(', ').slice(0, 300), label = address.slice(0, 180);
    const id = `${clean(p.osm_type, 2)}:${String(p.osm_id || '')}:${lat}:${lng}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const area = p.osm_key === 'boundary' || ['state', 'city', 'county', 'district', 'locality'].includes(p.type) || (p.osm_key === 'place' && ['region', 'province', 'city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'].includes(p.osm_value));
    const type = clean(p.osm_value || p.type, 40).replaceAll('_', ' ') || 'place';
    places.push({ id, name, address, label, lat, lng, type, area });
    if (places.length === 10) break;
  }
  return places;
}
async function readPlaces(response) {
  if (!response.ok) fail(503, 'Place search is temporarily unavailable. Try again or pin the location on the map.');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 512 * 1024) fail(503, 'Place search returned too much data. Try a more specific name.');
    chunks.push(chunk);
  }
  try { return photonPlaces(JSON.parse(Buffer.concat(chunks).toString())); }
  catch (error) {
    if (error.status) throw error;
    fail(503, 'Place search returned an unreadable response. Try again.');
  }
}
export function createPlaceLookup({ fetcher = fetch, endpoint = process.env.PLACE_SEARCH_URL || 'https://photon.komoot.io/api/', intervalMs = 1100 } = {}) {
  const cache = new Map(), pending = new Map();
  let queue = Promise.resolve(), lastStarted = 0;
  return async value => {
    const query = placeQuery(value), key = query.toLocaleLowerCase('en');
    const saved = cache.get(key);
    if (saved?.until > Date.now()) return saved.places;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 6) fail(429, 'Place search is busy. Please try again in a moment.');
    const work = queue.then(async () => {
      const wait = intervalMs - (Date.now() - lastStarted);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || url.username || url.password) fail(503, 'Place search is not configured correctly.');
      url.search = new URLSearchParams({ q: query, countrycode: 'PH', limit: '10', lang: 'en' }).toString();
      lastStarted = Date.now();
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json', 'User-Agent': 'CommandCenterPlatform/1.0 (https://ews-kappa.vercel.app)' } });
        const places = await readPlaces(response);
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, { until: Date.now() + 10 * 60 * 1000, places });
        return places;
      } catch (error) {
        if (error.status) throw error;
        fail(503, 'Place search could not connect. Try again or pin the location on the map.');
      }
    });
    queue = work.catch(() => {});
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  };
}
