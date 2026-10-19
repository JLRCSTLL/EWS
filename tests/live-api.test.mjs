import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { validSubscription } from '../server/push.mjs';
import { demoGeofences } from '../src/app/lib/residents.ts';

test('registered devices and approved command center share real persisted state with access control', async t => {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url),'utf8'));
  const app = createApp(db, { allowedOrigins:['http://test.local'], bootstrapToken:'isolated-test-owner-key' });
  const server = await new Promise(resolve => { const service = app.listen(0,'127.0.0.1',() => resolve(service)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = '';
    return async (path, body, method = body === undefined ? 'GET' : 'POST', origin = 'http://test.local') => {
      const response = await fetch(base+path,{ method, headers: { Cookie:cookie, Origin:origin, ...(body !== undefined ? {'Content-Type':'application/json'} : {}) }, body:body === undefined ? undefined : JSON.stringify(body) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status:response.status, headers:response.headers, data:await response.json() };
    };
  };
  const owner = client(), phone = client(), outsider = client(), secondPhone = client(), anonymous = client();
  const password = 'isolated-test-password-2026';
  let residentId, recovery, alertId;
  await t.test('registration creates resident accounts, hides password hashes, and returns one-time recovery codes', async () => {
    assert.equal((await anonymous('/state')).status,401);
    for (const [api,username,name] of [[owner,'qa_owner','QA Owner'],[phone,'qa_resident','QA Resident'],[outsider,'qa_outside','QA Outside']]) {
      const result = await api('/auth/register',{username,name,password,role:'admin'});
      assert.equal(result.status,201); assert.equal(result.data.recoveryCode.length,43);
      assert.match(result.headers.get('set-cookie'),/HttpOnly/); assert.match(result.headers.get('set-cookie'),/SameSite=Lax/);
      const state = (await api('/state')).data;
      assert.equal(state.user.role,'resident'); assert.equal(state.users.length,1);
      assert.equal(state.user.location,null); assert.equal(state.user.password_hash,undefined); assert.equal(state.user.recovery_hash,undefined);
      if (api === phone) { residentId = state.user.id; recovery = result.data.recoveryCode; }
    }
    const stored = (await db.query('select password_hash,recovery_hash from eligtas.users where id=$1',[residentId])).rows[0];
    assert.notEqual(stored.password_hash,password); assert.match(stored.password_hash,/^scrypt:/); assert.notEqual(stored.recovery_hash,recovery);
  });
  await t.test('wrong passwords, cross-site writes, and anonymous writes are rejected', async () => {
    assert.equal((await anonymous('/auth/login',{username:'qa_resident',password:'incorrect'})).status,401);
    assert.equal((await phone('/safe',{},'POST','https://untrusted.example')).status,403);
    assert.equal((await anonymous('/location',{lat:14.65,lng:121.11,accuracy:15},'PUT')).status,401);
  });
  await t.test('operator requests cannot promote themselves and one-time owner bootstrap is protected', async () => {
    assert.equal((await phone('/operator/request',{})).status,200);
    assert.equal((await phone('/operator/approve',{userId:residentId})).status,403);
    assert.equal((await owner('/operator/bootstrap',{token:'wrong'})).status,403);
    assert.equal((await owner('/operator/bootstrap',{token:'isolated-test-owner-key'})).status,200);
    assert.equal((await owner('/operator/bootstrap',{token:'isolated-test-owner-key'})).status,409);
    const state = (await owner('/state')).data; assert.equal(state.user.role,'admin'); assert.equal(state.users.length,3);
    assert.equal((await phone('/state')).data.users.length,1);
  });
  await t.test('separate authenticated device sessions see the same account and consented GPS location', async () => {
    assert.equal((await secondPhone('/auth/login',{username:'qa_resident',password})).status,200);
    assert.equal((await phone('/profile',{name:'QA Resident',municipality:'Marikina',groups:['pwd'],alertsEnabled:true,role:'admin'},'PUT')).status,200);
    assert.equal((await phone('/location',{lat:14.65,lng:121.11,accuracy:17},'PUT')).status,200);
    assert.equal((await outsider('/location',{lat:14.60,lng:120.99,accuracy:22},'PUT')).status,200);
    assert.equal((await phone('/location',{lat:999,lng:121,accuracy:1},'PUT')).status,400);
    const phoneState = (await secondPhone('/state?view=public')).data;
    assert.equal(phoneState.user.location.lat,14.65); assert.equal(phoneState.user.role,'resident');
    const operatorState = (await owner('/state')).data;
    assert.equal(operatorState.users.find(user => user.id === residentId).location.accuracy,17);
    assert.equal((await outsider('/state')).data.users.some(user => user.id === residentId),false);
  });
  const dispatch = () => ({id:randomUUID(),area:demoGeofences[2],groups:['pwd'],activeOnly:true,priority:'normal',content:'QA TEST — no emergency. Cross-device alert.'});
  await t.test('server calculates geofence/group recipients, rejects resident sends and empty audiences', async () => {
    assert.equal((await phone('/alerts',dispatch())).status,403);
    assert.equal((await owner('/alerts',{...dispatch(),area:{...demoGeofences[2],points:[]}})).status,400);
    assert.equal((await owner('/alerts',{...dispatch(),groups:['seniors']})).status,409);
    const message = dispatch(); alertId = message.id;
    const sent = await owner('/alerts',message); assert.equal(sent.status,201); assert.equal(sent.data.recipient_count,1);
    const repeated = await owner('/alerts',message); assert.equal(repeated.status,200); assert.equal(repeated.data.recipient_count,1);
    assert.equal((await owner('/alerts',{...message,content:'Changed after dispatch'})).status,409);
    assert.equal((await owner('/state')).data.alerts.length,1);
  });
  await t.test('targeted phone receives the stored alert; unrelated residents cannot see or acknowledge it', async () => {
    const inbox = (await secondPhone('/state?view=public')).data.alerts;
    assert.equal(inbox.length,1); assert.equal(inbox[0].id,alertId); assert.equal(inbox[0].received_at,null);
    assert.equal((await outsider('/state?view=public')).data.alerts.length,0);
    assert.equal((await outsider(`/alerts/${alertId}/receipt`,{read:true})).status,404);
    assert.equal((await owner('/state?view=public')).data.alerts.length,0);
    assert.equal((await secondPhone(`/alerts/${alertId}/receipt`,{read:false})).status,200);
    let delivery = (await owner('/state')).data.alerts[0]; assert.equal(delivery.received_count,1); assert.equal(delivery.read_count,0);
    await phone(`/alerts/${alertId}/receipt`,{read:true}); await phone(`/alerts/${alertId}/receipt`,{read:true});
    delivery = (await owner('/state')).data.alerts[0]; assert.equal(delivery.received_count,1); assert.equal(delivery.read_count,1);
  });
  await t.test('stale locations and alert opt-out are excluded from dispatch', async () => {
    await db.query("update eligtas.users set location_at=now()-interval '10 minutes' where id=$1",[residentId]);
    assert.equal((await owner('/alerts',dispatch())).status,409);
    assert.equal((await owner('/alerts',{...dispatch(),activeOnly:false})).status,201);
    await db.query("update eligtas.users set location_at=now()-interval '61 minutes' where id=$1",[residentId]);
    assert.equal((await owner('/alerts',{...dispatch(),activeOnly:false})).status,409);
    await phone('/location',{lat:14.65,lng:121.11,accuracy:15},'PUT');
    await phone('/profile',{name:'QA Resident',municipality:'Marikina',groups:['pwd'],alertsEnabled:false},'PUT');
    assert.equal((await owner('/alerts',dispatch())).status,409);
    await phone('/profile',{name:'QA Resident',municipality:'Marikina',groups:['pwd'],alertsEnabled:true},'PUT');
  });
  await t.test('help requests persist, enforce ownership and transition rules, and sync assigned teams', async () => {
    const request = {id:randomUUID(),type:'Medical assistance',people:2,note:'QA TEST ONLY',includeLocation:true};
    assert.equal((await phone('/requests',request)).status,201);
    assert.equal((await phone('/requests',{...request,id:randomUUID()})).status,409);
    assert.equal((await outsider(`/requests/${request.id}`,{status:'cancelled'},'PATCH')).status,404);
    assert.equal((await phone(`/requests/${request.id}`,{status:'assigned',unit:'Fake admin'},'PATCH')).status,403);
    assert.equal((await owner(`/requests/${request.id}`,{status:'resolved'},'PATCH')).status,409);
    assert.equal((await owner(`/requests/${request.id}`,{status:'acknowledged'},'PATCH')).status,200);
    assert.equal((await owner(`/requests/${request.id}`,{status:'assigned',unit:'QA Response Team'},'PATCH')).status,200);
    const requests = (await secondPhone('/state')).data.requests; assert.equal(requests.length,1); assert.equal(requests[0].assigned_unit,'QA Response Team');
    assert.equal((await outsider('/state')).data.requests.length,0);
    assert.equal((await owner(`/requests/${request.id}`,{status:'resolved'},'PATCH')).status,200);
    assert.equal((await owner(`/requests/${request.id}`,{status:'assigned',unit:'QA Response Team'},'PATCH')).status,409);
    assert.equal((await phone('/safe',{})).status,200);
    assert.ok((await owner('/state')).data.users.find(user => user.id === residentId).safeAt);
  });
  await t.test('stopping location sharing removes coordinates and prevents future geofenced targeting', async () => {
    assert.equal((await phone('/location',{},'DELETE')).status,200);
    const user = (await owner('/state')).data.users.find(user => user.id === residentId);
    assert.equal(user.locationSharing,false); assert.equal(user.location,null);
    assert.equal((await owner('/alerts',dispatch())).status,409);
    assert.equal((await phone('/requests',{id:randomUUID(),type:'Rescue',people:1,note:'test',includeLocation:true})).status,409);
  });
  await t.test('recovery codes rotate and revoke old sessions; logout invalidates the session', async () => {
    const recoveryClient = client();
    const recovered = await recoveryClient('/auth/recover',{username:'qa_resident',code:recovery,password:password+'new'});
    assert.equal(recovered.status,200); assert.notEqual(recovered.data.recoveryCode,recovery);
    assert.equal((await phone('/state')).status,401); assert.equal((await secondPhone('/state')).status,401);
    assert.equal((await anonymous('/auth/recover',{username:'qa_resident',code:recovery,password:password+'new'})).status,401);
    assert.equal((await recoveryClient('/auth/logout',{})).status,200);
    assert.equal((await recoveryClient('/state')).status,401);
  });
  await t.test('only the owner can approve a requested operator', async () => {
    const outsideId = (await outsider('/state')).data.user.id;
    assert.equal((await owner('/operator/approve',{userId:outsideId})).status,409);
    await outsider('/operator/request',{});
    assert.equal((await owner('/operator/approve',{userId:outsideId})).status,200);
    assert.equal((await outsider('/state')).data.user.role,'operator');
    assert.equal((await outsider('/operator/approve',{userId:residentId})).status,403);
  });
});

test('push subscriptions cannot point the server at internal or arbitrary URLs', () => {
  const subscription = endpoint => ({endpoint,keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}});
  assert.equal(validSubscription(subscription('https://fcm.googleapis.com/fcm/send/example')),true);
  assert.equal(validSubscription(subscription('https://web.push.apple.com/example')),true);
  for (const endpoint of ['http://127.0.0.1:80','https://example.org/push','https://fcm.googleapis.com.attacker.test/x','https://fcm.googleapis.com:444/x','https://user@fcm.googleapis.com/x']) assert.equal(validSubscription(subscription(endpoint)),false);
});
