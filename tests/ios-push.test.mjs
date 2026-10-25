import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { applePayload, liveActivityPayload, setupIosPush, validAppleToken } from '../server/ios-push.mjs';

test('iPhone messages are visible APNs alerts; critical audio requires approval and permission', () => {
  const alert = {id:randomUUID(),priority:'critical',content:'TEST ONLY — '+'🌧️'.repeat(1000)};
  const device = {user_id:randomUUID(),critical_enabled:false};
  for(const approved of [false,true]) {
    const data=applePayload(alert,device,approved);
    assert.equal(data.aps['interruption-level'],'time-sensitive');assert.equal(data.aps.sound,'default');
    assert.ok(data.aps.alert.body.startsWith('TEST ONLY'));assert.ok(Buffer.byteLength(JSON.stringify(data))<4096);
    assert.equal(data.aps.category,'TANOVIQ_ALERT');
  }
  assert.equal(applePayload(alert,{...device,critical_enabled:true},false).aps['interruption-level'],'time-sensitive');
  const critical=applePayload(alert,{...device,critical_enabled:true},true);
  assert.equal(critical.aps.sound.critical,1);assert.equal(critical.aps.sound.volume,1);
  const live=liveActivityPayload(alert,device,1792800000000);
  assert.equal(live.aps['attributes-type'],'TANOVIQAlertAttributes');assert.equal(live.aps.event,'start');
  assert.deepEqual(live.aps.attributes,{alertID:alert.id,userID:device.user_id});
  assert.equal(live.aps['stale-date']-live.aps.timestamp,300);assert.equal(live.aps.alert.sound,undefined);
  assert.equal(live.aps['content-state'].acknowledged,false);assert.ok(Buffer.byteLength(JSON.stringify(live))<4096);
  assert.equal(setupIosPush({},{}),null);
  for(const invalid of ['short','g'.repeat(64),'a'.repeat(514),{},null]) assert.equal(validAppleToken(invalid),false);
});

test('iOS push uses actual recipients, separate APNs topics, and expires invalid devices',async t=>{
  const db=new PGlite();await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));t.after(()=>db.close());
  const a=randomUUID(),b=randomUUID(),id=randomUUID();
  for(const [user,name,token] of [[a,'alice','a'],[b,'bob','b']]) {
    await db.query('insert into eligtas.users(id,username,name,password_hash,recovery_hash) values($1,$2,$2,$2,$2)',[user,name]);
    await db.query("insert into eligtas.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",[name,user]);
    await db.query("insert into eligtas.ios_devices(token,user_id,session_hash,environment,live_start_token,live_enabled) values($1,$2,$3,'production',$4,true)",[token.repeat(64),user,name,token.repeat(128)]);
  }
  await db.query("insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only) values($1,$2,'TEST','high','{}','{}',true)",[id,a]);
  await db.query('insert into eligtas.receipts(alert_id,user_id) values($1,$2)',[id,a]);
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const env={APNS_KEY_ID:'1234567890',APNS_TEAM_ID:'0987654321',APNS_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'})};
  const sent=[];let expired=false;
  const push=setupIosPush(db,env,async request=>{sent.push(request);return {status:expired?410:200};});
  const alert={id,priority:'high',content:'TEST ONLY — no emergency'};await push.send(alert);
  assert.equal(sent.length,2);assert.equal(sent[0].token,'a'.repeat(64));assert.equal(sent[0].payload.userId,a);
  assert.equal(sent[0].headers['apns-push-type'],'alert');assert.equal(sent[1].headers['apns-push-type'],'liveactivity');
  assert.equal(sent[1].headers['apns-topic'],'ph.tanoviq.app.push-type.liveactivity');
  assert.equal(sent[0].environment,'production');assert.equal(sent[0].headers.authorization.split('.').length,3);
  await db.query('insert into eligtas.ios_activities(token,device_token,alert_id) values($1,$2,$3)',['c'.repeat(128),'a'.repeat(64),id]);
  await push.acknowledge(a,id);assert.equal(sent[2].payload.aps.event,'end');assert.equal((await db.query('select * from eligtas.ios_activities')).rows.length,0);
  expired=true;await push.send(alert);assert.equal((await db.query('select user_id from eligtas.ios_devices')).rows[0].user_id,b);
});

test('iOS registrations and activities require the signed-in recipient and are revoked on logout',async t=>{
  const db=new PGlite();await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const app=createApp(db,{allowedOrigins:['http://ios.test'],push:{iosReady:true}});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const client=()=>{let cookie='';return async(path,body,method=body?'POST':'GET')=>{
    const response=await fetch(base+path,{method,headers:{Origin:'http://ios.test',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;
  };};
  const a=client(),b=client(),registration={token:'a'.repeat(64),environment:'production',liveStartToken:'a'.repeat(128),liveEnabled:true,criticalEnabled:false};
  assert.equal((await a('/push/ios',registration)).status,401);
  for(const [api,name]of[[a,'ios_alice'],[b,'ios_bob']])assert.equal((await api('/auth/register',{username:name,name,password:'isolated-ios-password'})).status,201);
  const alice=(await (await a('/state?view=public')).json()).user.id;
  const alertId=randomUUID();
  await db.query("insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only) values($1,$2,'TEST','high','{}','{}',true)",[alertId,alice]);
  await db.query('insert into eligtas.receipts(alert_id,user_id) values($1,$2)',[alertId,alice]);
  assert.equal((await a('/push/ios',{...registration,environment:'evil'})).status,400);
  assert.equal((await a('/push/ios',registration)).status,200);
  const activity={token:'c'.repeat(128),deviceToken:registration.token,alertId};
  assert.equal((await b('/push/ios/activity',activity)).status,404);
  assert.equal((await a('/push/ios/activity',activity)).status,200);
  assert.equal((await b('/push/ios',{token:registration.token},'DELETE')).status,200);
  assert.equal((await db.query('select * from eligtas.ios_devices')).rows.length,1);
  assert.equal((await b(`/alerts/${alertId}/receipt`,{read:true})).status,404);
  await a('/auth/logout',{});
  assert.equal((await db.query('select * from eligtas.ios_devices')).rows.length,0);
  assert.equal((await db.query('select * from eligtas.ios_activities')).rows.length,0);
});
