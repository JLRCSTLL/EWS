import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, ReadReconnect, retryAfterMilliseconds } from '../src/app/lib/api-client.ts';
import { readMigratedPreference } from '../src/app/lib/local-preferences.ts';

test('a hosting verification page is never accepted as a signed-out API session', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>verification</html>', { status: 401 }));
  await assert.rejects(api('/state'), e => e instanceof ApiError && e.kind === 'hosting' && e.status === 401);
});
test('a real unauthorized API response still allows the sign-in flow', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Sign in required.' }, { status: 401 }));
  await assert.rejects(api('/state'), e => e instanceof ApiError && e.kind === 'api' && e.status === 401);
});
test('rate limiting respects Retry-After before allowing the next state request', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Busy</html>', { status: 429, headers: { 'Retry-After': '90' } }));
  const backoff = new ReadReconnect();
  let error; try { await api('/state'); } catch (e) { error = e; }
  backoff.failed(error, 1000);
  assert.equal(backoff.canRequest(90000), false);
  assert.equal(backoff.canRequest(91000), true);
  backoff.reset(); assert.equal(backoff.canRequest(1001), true);
  assert.equal(retryAfterMilliseconds('Sun, 08 Nov 2026 03:01:00 GMT', Date.parse('2026-11-08T03:00:00Z')), 60000);
});
test('an unconfirmed alert is sent once and is not automatically replayed', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new DOMException('Timed out', 'TimeoutError'); });
  await assert.rejects(api('/alerts', { content: 'Test' }), /could not be confirmed/);
  assert.equal(calls, 1);
});
test('repeated failures back off while a successful read returns the real response', async t => {
  const backoff = new ReadReconnect();
  backoff.failed(new Error('network'), 0); const first = backoff.nextAt;
  backoff.failed(new Error('network'), 0); assert.ok(backoff.nextAt > first);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ user: { id: 'fixture' }, alerts: [] }));
  assert.deepEqual((await api('/state')).alerts, []);
  backoff.reset(); assert.equal(backoff.failures, 0);
});
test('preference migration preserves read receipts and removes only the matching old key', () => {
  const values = new Map([['previous-command-notifications:user-a', '["read-alert"]'], ['unrelated', 'keep']]);
  const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  assert.equal(readMigratedPreference('agila-command-notifications:user-a', '-command-notifications:user-a', storage), '["read-alert"]');
  assert.equal(values.has('previous-command-notifications:user-a'), false);
  assert.equal(values.get('unrelated'), 'keep');
});
