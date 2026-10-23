import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { setupAndroidPush, validAndroidToken } from '../server/android-push.mjs';

test('Android token validation and missing Firebase configuration are explicit', () => {
  assert.equal(setupAndroidPush({},''),null);
  assert.equal(validAndroidToken('test:token_'+'a'.repeat(100)),true);
  for (const token of ['short','https://example.com',{},'a'.repeat(5000)]) assert.equal(validAndroidToken(token),false);
});
test('Android push targets actual recipients, uses urgent data payloads, and removes only unregistered tokens', async t => {
  const db = new PGlite(); await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8')); t.after(() => db.close());
  const [a,b] = [randomUUID(),randomUUID()], alertId = randomUUID();
  for (const [id,name] of [[a,'alice'],[b,'bob']]) {
    await db.query('insert into eligtas.users(id,username,name,password_hash,recovery_hash) values ($1,$2,$2,$2,$2)',[id,name]);
    await db.query("insert into eligtas.sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '1 day')",[name,id]);
    await db.query('insert into eligtas.android_devices(token,user_id,session_hash) values ($1,$2,$3)',[name.repeat(30),id,name]);
  }
  await db.query("insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only) values ($1,$2,'TEST','critical','{}','{}',true)",[alertId,a]);
  await db.query('insert into eligtas.receipts(alert_id,user_id) values ($1,$2)',[alertId,a]);
  const { privateKey } = generateKeyPairSync('rsa',{modulusLength:2048});
  const config = { project_id:'eligtas-test',client_email:'push@eligtas-test.iam.gserviceaccount.com',private_key:privateKey.export({format:'pem',type:'pkcs8'}) };
  const sent = []; let oauth = 0, unregistered = false;
  const request = async (url,options) => {
    if (url === 'https://oauth2.googleapis.com/token') { oauth++; return new Response(JSON.stringify({access_token:'test-access',expires_in:3600})); }
    sent.push(JSON.parse(options.body));
    return unregistered ? new Response(JSON.stringify({error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}}),{status:404}) : new Response(JSON.stringify({name:'messages/test'}));
  };
  const push = setupAndroidPush(db,config,request);
  await push.send({id:alertId,content:'TEST — no emergency',priority:'critical'});
  assert.equal(sent.length,1); assert.equal(sent[0].message.token,'alice'.repeat(30));
  assert.equal(sent[0].message.android.priority,'HIGH'); assert.equal(sent[0].message.data.userId,a); assert.equal(sent[0].message.notification,undefined);
  await push.send({id:alertId,content:'TEST — high priority',priority:'high'});
  assert.equal(sent[1].message.android.priority,'HIGH'); assert.equal(sent[1].message.data.priority,'high');
  assert.equal(sent[1].message.notification,undefined); assert.equal(sent[1].message.android.ttl,'300s');
  unregistered = true; await push.send({id:alertId,content:'TEST',priority:'normal'});
  assert.equal(oauth,1); assert.equal(sent[2].message.android.priority,'NORMAL');
  assert.equal((await db.query('select * from eligtas.android_devices where user_id=$1',[a])).rows.length,0);
  assert.equal((await db.query('select * from eligtas.android_devices where user_id=$1',[b])).rows.length,1);
});
test('Android registrations require sign-in, cannot delete another account’s device, and expire on logout', async t => {
  const db = new PGlite(); await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const app = createApp(db,{allowedOrigins:['http://test.local'],push:{androidReady:true}});
  const server = await new Promise(resolve => { const s=app.listen(0,'127.0.0.1',() => resolve(s)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, token='test:'+'a'.repeat(120);
  const client = () => { let cookie=''; return async (path,body,method='POST') => {
    const response=await fetch(base+path,{method,headers:{Origin:'http://test.local',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0]; return response;
  }; };
  const a=client(),b=client();
  assert.equal((await a('/push/android',{token})).status,401);
  for(const [api,username] of [[a,'phone_a'],[b,'phone_b']]) assert.equal((await api('/auth/register',{username,name:username,password:'isolated-test-password'})).status,201);
  assert.equal((await a('/push/android',{token:'bad'})).status,400);
  assert.equal((await a('/push/android',{token})).status,200);
  assert.equal((await b('/push/android',{token},'DELETE')).status,200);
  assert.equal((await db.query('select * from eligtas.android_devices')).rows.length,1);
  await a('/auth/logout',{});
  assert.equal((await db.query('select * from eligtas.android_devices')).rows.length,0);
  assert.equal((await a('/push/android',{token})).status,401);
});
