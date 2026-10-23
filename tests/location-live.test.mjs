import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { locationFix } from '../server/location.mjs';
import { liveLocationLabel } from '../src/app/lib/residents.ts';

test('GPS timestamps reject cached or future fixes and distinguish live from last seen', () => {
  const now = Date.now(), fix = {lat:14.65,lng:121.11,accuracy:12};
  assert.throws(() => locationFix({...fix,capturedAt:new Date(now-121000).toISOString()},now));
  assert.throws(() => locationFix({...fix,capturedAt:new Date(now+31000).toISOString()},now));
  assert.throws(() => locationFix({...fix,accuracy:-1},now));
  assert.equal(locationFix(fix,now).capturedAt,new Date(now).toISOString());
  assert.equal(liveLocationLabel(new Date(now-5000).toISOString(),new Date(now).toISOString()),'Live · 5s ago');
  assert.equal(liveLocationLabel(new Date(now-45000).toISOString(),new Date(now).toISOString()),'Last seen 45s ago');
});

test('Android locations reach an authenticated command center, stop safely, and remain private', async t => {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const app = createApp(db,{allowedOrigins:['https://test.local'],bootstrapToken:'test-owner-key'});
  const server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',() => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); });
  const headers = {'Origin':'https://test.local','Content-Type':'application/json'};
  function client() {
    let cookie = '';
    return {
      request: async (path,body,method=body===undefined?'GET':'POST') => {
        const res = await fetch(base+path,{method,headers:{...headers,Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
        if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
        return {status:res.status,data:await res.json()};
      },
      stream: () => fetch(base+'/location/events',{headers:{Cookie:cookie}}),
    };
  }
  const operator = client(), phone = client(), other = client();
  for (const [client,username] of [[operator,'test_operator'],[phone,'test_phone'],[other,'test_other']])
    assert.equal((await client.request('/auth/register',{username,name:username,password:'test-password-12345'})).status,201);
  await operator.request('/operator/bootstrap',{token:'test-owner-key'});
  const phoneId = (await phone.request('/state')).data.user.id;
  let token = (await phone.request('/location/share',{})).data.token;
  const native = async (body,method='PUT',share=token) => {
    const res = await fetch(base+'/location/native',{method,headers:{...headers,Authorization:`Bearer ${share}`},body:JSON.stringify(body)});
    return {status:res.status,data:await res.json()};
  };
  const fix = (lat=14.65,when=Date.now()) => ({lat,lng:121.11,accuracy:13,capturedAt:new Date(when).toISOString()});
  await t.test('the location-only credential cannot read accounts or send alerts',async () => {
    const state = await fetch(base+'/state',{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(state.status,401);
    assert.equal((await native(fix(),'PUT','invalid')).status,401);
    assert.equal((await other.request('/state')).data.users.length,1);
  });
  await t.test('separate device uploads emit a location event and update operator coordinates',async () => {
    const res = await operator.stream(); assert.equal(res.status,200);
    assert.match(res.headers.get('content-type'),/text\/event-stream/);
    const reader = res.body.getReader(), decode = new TextDecoder(); let text = '';
    while (!text.includes('event: ready')) text += decode.decode((await reader.read()).value);
    assert.equal((await native(fix())).status,200);
    const timeout = setTimeout(() => reader.cancel(),4000);
    try {
      while (!text.includes('event: location')) { const next = await reader.read(); if (next.done) break; text += decode.decode(next.value); }
      assert.match(text,/event: location/); assert.doesNotMatch(text,/14\.65|121\.11|test_phone/);
    } finally { clearTimeout(timeout); await reader.cancel(); }
    const located = (await operator.request('/state')).data.users.find(u=>u.id===phoneId).location;
    assert.equal(located.lat,14.65); assert.equal(located.accuracy,13);
    assert.equal((await other.request('/state')).data.users.some(u=>u.id===phoneId),false);
  });
  await t.test('older and cached fixes cannot replace the newest reported location',async () => {
    const now = Date.now();
    assert.equal((await native(fix(14.66,now))).data.accepted,true);
    assert.equal((await native(fix(14.60,now-1000))).data.accepted,false);
    assert.equal((await native(fix(14.60,now-121000))).status,400);
    assert.equal((await operator.request('/state')).data.users.find(u=>u.id===phoneId).location.lat,14.66);
  });
  await t.test('replacing a sharing session invalidates the old device token',async () => {
    const old = token; token = (await phone.request('/location/share',{})).data.token;
    assert.equal((await native(fix(),'PUT',old)).status,401);
    assert.equal((await native({},'DELETE',old)).status,401);
    assert.equal((await native(fix())).status,200);
  });
  await t.test('Stop in the Android notification removes the pin and rejects delayed updates',async () => {
    assert.equal((await native({},'DELETE')).status,200);
    assert.equal((await native(fix())).status,401);
    assert.equal((await operator.request('/state')).data.users.find(u=>u.id===phoneId).location,null);
  });
  await t.test('web Stop and logout revoke native sharing as well',async () => {
    token = (await phone.request('/location/share',{})).data.token;
    await native(fix());
    assert.equal((await phone.request('/location',{},'DELETE')).status,200);
    assert.equal((await native(fix())).status,401);
    token = (await phone.request('/location/share',{})).data.token;
    await phone.request('/auth/logout',{});
    assert.equal((await native(fix())).status,401);
  });
});
