import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostedPlaceLookup, createPlaceSearchGateway, sessionCookie } from '../server/place-search-gateway.mjs';
import handler from '../api/dispatch-place-search.js';

const cookie = 'eligtas_session=' + 'a'.repeat(43);
const place = { id: 'test', name: 'TEST ONLY mall', address: 'Mandaluyong', label: 'TEST ONLY mall, Mandaluyong', lat: 14.58, lng: 121.05, type: 'mall', area: false };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

test('gateway forwards only the existing app session cookie', () => {
  assert.equal(sessionCookie('analytics=private; ' + cookie + '; unrelated=secret'), cookie);
  for (const value of [null, '', 'eligtas_session=short', cookie + 'extra']) assert.equal(sessionCookie(value), null);
});

test('every hosted query checks current operator access, including cached results', async () => {
  let access = 200, checks = 0, lookups = 0;
  const search = createPlaceSearchGateway({ fetcher: async (url, options) => {
    checks++;
    assert.equal(url, 'https://e-ligtas.onrender.com/api/response-places/authorize');
    assert.equal(options.headers.Cookie, cookie);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return json({ ok: access === 200 }, access);
  }, search: async query => { lookups++; assert.equal(query, 'SM Megamall'); return [place]; } });
  assert.deepEqual(await search(' SM Megamall ', cookie + '; unrelated=secret'), [place]);
  access = 403;
  await assert.rejects(search('SM Megamall', cookie), { status: 403 });
  assert.equal(checks, 2);
  assert.equal(lookups, 1);
});

test('invalid searches and missing sessions never contact the provider or auth service', async () => {
  const unexpected = async () => assert.fail('No network request expected');
  const search = createPlaceSearchGateway({ fetcher: unexpected, search: unexpected });
  await assert.rejects(search('SM Megamall', ''), { status: 401 });
  await assert.rejects(search('x', cookie), { status: 400 });
});

test('gateway fails closed on unavailable, redirected or malformed authorization', async () => {
  for (const [authorization, status] of [
    [() => json({ ok: false }, 401), 401], [() => json({ ok: false }, 429), 429],
    [() => json({ ok: true }, 302), 503], [() => json({}, 200), 503],
    [() => new Response('login page'), 503], [() => { throw new Error('private network detail'); }, 503],
  ]) {
    const search = createPlaceSearchGateway({ fetcher: authorization, search: async () => assert.fail('Unauthorized provider request') });
    await assert.rejects(search('SM Megamall', cookie), { status });
  }
});

test('Render relay uses the fixed existing frontend and validates returned coordinates', async () => {
  let payload = { places: [place] };
  const search = createHostedPlaceLookup({ fetcher: async (url, options) => {
    assert.equal(url.origin, 'https://ews-kappa.vercel.app');
    assert.equal(url.pathname, '/api/response-places');
    assert.equal(url.searchParams.get('q'), 'SM Megamall');
    assert.equal(options.headers.Cookie, cookie);
    assert.equal(options.redirect, 'error');
    return json(payload);
  } });
  assert.deepEqual(await search('SM Megamall', cookie + '; private_cookie=hidden'), [place]);
  payload = { places: [{ ...place, lat: 99 }] };
  await assert.rejects(search('SM Megamall', cookie), { status: 503 });
  await assert.rejects(createHostedPlaceLookup({ fetcher: async () => json({}, 403) })('SM Megamall', cookie), { status: 403 });
});

test('serverless handler rejects mutations and ambiguous queries without authentication traffic', async () => {
  for (const [method, url, status] of [['POST', '/api/response-places?q=mall', 405], ['GET', '/api/response-places?q=a&q=b', 400], ['GET', '/api/response-places?q=mall', 401]]) {
    const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
    await handler({ method, url, headers: {} }, res);
    assert.equal(res.code, status);
    assert.match(res.headers['Cache-Control'], /no-store/);
    assert.equal(typeof res.body.error, 'string');
  }
});
