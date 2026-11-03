import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceLookup, photonPlaces, placeQuery } from '../server/place-lookup.mjs';
import { searchDispatchPlaces } from '../src/app/lib/dispatch-places.ts';

const feature = (name, id, properties = {}, coordinates = [121.056, 14.585]) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates },
  properties: { name, osm_type: 'N', osm_id: id, countrycode: 'PH', city: 'Mandaluyong', state: 'Metro Manila', osm_key: 'shop', osm_value: 'mall', ...properties },
});
const response = features => new Response(JSON.stringify({ features }), { headers: { 'content-type': 'application/json' } });

test('search validates input without changing meaningful place names', () => {
  assert.equal(placeQuery('  SM   Megamall, Mandaluyong  '), 'SM Megamall, Mandaluyong');
  assert.equal(placeQuery('Region IV-A'), 'Region IV-A');
  for (const query of ['', 'x', 'x'.repeat(161), ['Cainta'], null, 'Cainta\0']) assert.throws(() => placeQuery(query), { status: 400 });
});
test('mall, office and administrative results retain coordinates and address context', () => {
  const mall = feature('SM Megamall', 1);
  const result = photonPlaces({ features: [mall, mall,
    feature('Municipal office', 2, { osm_key: 'office', osm_value: 'government' }),
    feature('San Juan', 3, { osm_key: 'place', osm_value: 'village', city: 'Cainta', state: 'Rizal' }),
    feature('Calabarzon', 4, { osm_key: 'boundary', osm_value: 'administrative', type: 'state' }),
    feature('Outside the Philippines', 5, { countrycode: 'DE' }),
    feature('Invalid coordinates', 6, {}, [200, 100]),
    feature('Invalid country', 7, { countrycode: 12 }),
    { properties: null }, null,
  ] });
  assert.equal(result.length, 4);
  assert.equal(result[0].lat, 14.585);
  assert.equal(result[0].lng, 121.056);
  assert.equal(result[0].label, 'SM Megamall, Mandaluyong, Metro Manila');
  assert.equal(result[0].area, false);
  assert.equal(result[2].area, true);
  assert.match(result[2].address, /Cainta, Rizal/);
  assert.equal(result[3].area, true);
});
test('shared lookup deduplicates concurrent searches, caches results and limits provider parameters', async () => {
  const requests = [];
  const search = createPlaceLookup({ intervalMs: 0, fetcher: async (url, options) => {
    requests.push({ url: new URL(url), options });
    return response([feature('SM Megamall', 1)]);
  } });
  const [a, b] = await Promise.all([search('SM Megamall'), search('sm megamall')]);
  assert.deepEqual(a, b);
  assert.deepEqual(await search('SM Megamall'), a);
  assert.equal(requests.length, 1);
  assert.deepEqual([...requests[0].url.searchParams.keys()], ['q', 'countrycode', 'limit', 'lang']);
  assert.equal(requests[0].url.searchParams.get('countrycode'), 'PH');
  assert.equal(requests[0].options.headers.Cookie, undefined);
  assert.equal(requests[0].options.headers.Authorization, undefined);
});
test('provider errors are not mistaken for no results and a failed search can be retried', async () => {
  let calls = 0;
  const search = createPlaceLookup({ intervalMs: 0, fetcher: async () => ++calls === 1 ? new Response('', { status: 503 }) : response([]) });
  await assert.rejects(search('Cainta'), { status: 503, publicMessage: 'Place search is temporarily unavailable. Try again or pin the location on the map.', code: 'PLACE_SEARCH_UPSTREAM_503' });
  assert.deepEqual(await search('Cainta'), []);
  assert.equal(calls, 2);
  await assert.rejects(createPlaceLookup({ intervalMs: 0, fetcher: async () => new Response('not json') })('Cainta'), { status: 503 });
  await assert.rejects(createPlaceLookup({ intervalMs: 0, fetcher: async () => new Response('x'.repeat(512 * 1024 + 1)) })('Cainta'), { status: 503 });
  await assert.rejects(createPlaceLookup({ intervalMs: 0, fetcher: async () => { throw Object.assign(new Error('private provider detail'), { cause: { code: 'ETIMEDOUT' } }); } })('Cainta'), { status: 503, publicMessage: 'Place search could not connect. Try again or pin the location on the map.', code: 'PLACE_SEARCH_ETIMEDOUT' });
});
test('lookup queue spaces provider calls and rejects excessive pending searches', async () => {
  const starts = [];
  const search = createPlaceLookup({ intervalMs: 25, fetcher: async () => { starts.push(Date.now()); return response([]); } });
  const pending = Array.from({ length: 6 }, (_, i) => search('Place ' + i));
  await assert.rejects(search('Place 7'), { status: 429 });
  await Promise.all(pending);
  assert.equal(starts.length, 6);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 20);
});
test('client searches the authenticated local API and exposes service errors', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), '/api/response-places?q=SM+Megamall');
    assert.equal(options.credentials, 'include');
    assert.equal(options.signal.aborted, false);
    return new Response(JSON.stringify({ places: [] }));
  });
  assert.deepEqual(await searchDispatchPlaces(' SM Megamall ', controller.signal), []);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Approved operator access is required.' }), { status: 403 }));
  await assert.rejects(searchDispatchPlaces('SM Megamall', controller.signal), /Approved operator/);
});
