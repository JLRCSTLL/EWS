import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { digest } from '../server/auth.mjs';
import { validateAudio } from '../server/alert-audio.mjs';
import { pcmWave } from '../src/app/lib/alert-audio.ts';

function clip(seconds = 1) {
  const samples = Float32Array.from({ length: Math.floor(seconds * 16000) }, (_, i) => .2 * Math.sin(i * 2 * Math.PI * 440 / 16000));
  return { name: 'TEST ONLY tone', kind: 'voice', data: Buffer.from(pcmWave(samples)).toString('base64') };
}
test('audio validation checks actual PCM format, duration, silence and bounded data', () => {
  assert.equal(validateAudio(clip()).durationMs, 1000);
  assert.equal(validateAudio(clip(30)).byteLength, 960044);
  assert.throws(() => validateAudio(clip(30.1)), /30 seconds/);
  assert.throws(() => validateAudio(clip(.05)), /Invalid audio/);
  assert.throws(() => validateAudio({ ...clip(), data: Buffer.from(pcmWave(new Float32Array(16000))).toString('base64') }), /silent/);
  const invalid = Buffer.from(clip().data, 'base64'); invalid.writeUInt32LE(9999999, 40);
  assert.throws(() => validateAudio({ ...clip(), data: invalid.toString('base64') }), /Invalid audio/);
  for (const data of ['<script>alert(1)</script>', 'AA@@', 'AAAA=']) assert.throws(() => validateAudio({ ...clip(), data }));
  assert.throws(() => validateAudio({ ...clip(), kind: 'url', name: 'https://example.com/audio' }));
});

test('custom alert audio is bound to dispatch, private to recipients, and preserved on retries', async t => {
  const db = new PGlite(); await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const pushed = [], app = createApp(db, { allowedOrigins: ['https://test.local'], push: { send: async a => pushed.push(a) } });
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const accounts = {};
  for (const [name, role] of [['owner', 'admin'], ['other', 'operator'], ['member', 'resident'], ['outsider', 'resident']]) {
    const id = randomUUID(), token = randomBytes(32).toString('base64url'); accounts[name] = { id, token };
    await db.query('insert into eligtas.users(id,username,name,password_hash,recovery_hash,role) values ($1,$2,$2,$3,$3,$4)', [id, name, 'isolated-test-placeholder', role]);
    await db.query("insert into eligtas.sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')", [digest(token), id]);
  }
  const request = async (name, path, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'https://test.local', ...(accounts[name] ? { Cookie: `eligtas_session=${accounts[name].token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const audio = response.headers.get('content-type')?.startsWith('audio/wav');
    return { status: response.status, data: audio ? Buffer.from(await response.arrayBuffer()) : await response.json(), headers: response.headers };
  };
  const source = clip();
  assert.equal((await request('anonymous', '/alert-audio', source)).status, 401);
  assert.equal((await request('member', '/alert-audio', source)).status, 403);
  const upload = await request('owner', '/alert-audio', source);
  assert.equal(upload.status, 201); const audio = upload.data;
  const path = '/alert-audio/' + audio.id;
  assert.deepEqual((await request('owner', path)).data, Buffer.from(source.data, 'base64'));
  assert.equal((await request('other', path)).status, 404);
  assert.equal((await request('member', path)).status, 404);
  assert.equal((await request('anonymous', path)).status, 401);
  const group = randomUUID();
  await db.query('insert into eligtas.team_groups(id,name,tag) values ($1,$2,$3)', [group, 'Test recipients', 'test']);
  await db.query('insert into eligtas.group_members(group_id,user_id) values ($1,$2)', [group, accounts.member.id]);
  const body = { id: randomUUID(), targetMode: 'groups', teamGroupIds: [group], content: 'TEST ONLY. Written instructions remain available.', priority: 'high', audioId: audio.id };
  assert.equal((await request('other', '/alerts/preview', body)).status, 404);
  const preview = await request('owner', '/alerts/preview', body); assert.equal(preview.status, 200);
  const second = (await request('owner', '/alert-audio', { ...source, name: 'Second clip' })).data;
  assert.equal((await request('owner', '/alerts', { ...body, audioId: second.id, previewHash: preview.data.previewHash })).status, 409);
  const sent = await request('owner', '/alerts', { ...body, previewHash: preview.data.previewHash });
  assert.equal(sent.status, 201); assert.deepEqual(sent.data.audio, audio);
  assert.equal((await request('owner', '/alerts', { ...body, previewHash: preview.data.previewHash })).status, 200);
  assert.equal((await request('owner', '/alerts', { ...body, audioId: second.id, previewHash: preview.data.previewHash })).status, 409);
  assert.equal(pushed.length, 1); assert.deepEqual(pushed[0].audio, audio);
  const delivered = await request('member', path);
  assert.equal(delivered.status, 200); assert.deepEqual(delivered.data, Buffer.from(source.data, 'base64'));
  assert.equal(delivered.headers.get('cache-control'), 'no-store');
  assert.equal((await request('other', path)).status, 200);
  assert.equal((await request('outsider', path)).status, 404);
  assert.equal((await request('member', '/alert-audio/' + second.id)).status, 404);
  const state = (await request('member', '/state')).data;
  assert.deepEqual(state.alerts[0].audio, audio); assert.equal(JSON.stringify(state).includes(source.data), false);
  assert.equal((await request('owner', '/config')).data.alertAudioReady, true);
  await db.query("update eligtas.alert_audio set created_at=now()-interval '2 days'");
  await request('owner', '/alert-audio', source);
  assert.equal((await request('owner', '/alert-audio/' + second.id)).status, 404);
  assert.equal((await request('member', path)).status, 200);
  await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  assert.equal((await request('member', path)).status, 200);
});
