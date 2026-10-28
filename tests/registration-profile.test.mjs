import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { emptyEmergencyProfile } from '../src/app/lib/emergency-profile.ts';
import { asResident } from '../src/app/lib/live-model.ts';

test('registration profiles persist, remain private, and support consented emergency planning',async t=>{
  const db=new PGlite();const schema=await readFile(new URL('../server/schema.sql',import.meta.url),'utf8');await db.exec(schema);
  const server=await new Promise(resolve=>{const s=createApp(db,{allowedOrigins:['http://test.local'],bootstrapToken:'profile-test-owner'}).listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  function client(){let cookie='';return async(path,body,method=body===undefined?'GET':'POST')=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Cookie:cookie,Origin:'http://test.local',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return{status:res.status,data:await res.json()};};}
  const owner=client(),person=client(),other=client(),anonymous=client();const password='registration-test-password-2026';
  const emergencyProfile={...emptyEmergencyProfile(),ageRange:'60plus',pwdStatus:'yes',assistanceNeeds:['mobility','transport'],shareWithOperators:true,emergencyContact:{name:'Test Trusted Person',phone:'+639170000002',relationship:'family'},contactConsent:true};
  const full={name:'Test Personnel',username:'profile_person',password,email:'profile@example.invalid',phone:'+639170000001',municipality:'Cainta',province:'Rizal',barangay:'San Juan',emergencyProfile};
  let id,requestId;
  await t.test('new registration saves all fields without granting access or starting tracking',async()=>{
    assert.equal((await owner('/auth/register',{name:'Test Owner',username:'profile_owner',password})).status,201);
    assert.equal((await owner('/operator/bootstrap',{token:'profile-test-owner'})).status,200);
    const registered=await person('/auth/register',{...full,role:'admin',onDuty:true,locationSharing:true,lat:14,lng:121});assert.equal(registered.status,201);
    assert.equal((await other('/auth/register',{name:'Test Other',username:'profile_other',password})).status,201);
    const {user}= (await person('/state')).data;id=user.id;
    for(const field of ['name','email','phone','municipality','province','barangay'])assert.equal(user[field],full[field]);
    assert.deepEqual(user.emergencyProfile,emergencyProfile);assert.equal(user.role,'resident');assert.equal(user.onDuty,false);assert.equal(user.location,null);
    assert.deepEqual(user.groups,['pwd','seniors']);assert.equal(registered.data.password,undefined);
  });
  await t.test('operators get shared response needs but contacts and home area remain private',async()=>{
    const found=(await owner('/state')).data.users.find(u=>u.id===id);
    assert.equal(found.emergencyProfile.ageRange,'60plus');assert.equal(found.emergencyProfile.pwdStatus,'yes');assert.deepEqual(found.emergencyProfile.assistanceNeeds,['mobility','transport']);
    assert.equal(found.emergencyProfile.emergencyContact,undefined);assert.equal(found.emergencyContact.name,'');assert.notEqual(found.emergencyContact.phone,full.emergencyProfile.emergencyContact.phone);
    assert.notEqual(found.phone,full.phone);assert.notEqual(found.email,full.email);assert.equal(found.municipality,'');assert.equal(found.province,'');assert.equal(found.barangay,'');
    assert.equal(asResident(found).pwd,true);assert.equal(asResident(found).age,65);
    assert.equal((await other('/state')).data.users.some(u=>u.id===id),false);assert.equal((await anonymous('/state')).status,401);
  });
  await t.test('invalid registration is rejected before inserting a partial account',async()=>{
    const bad=await anonymous('/auth/register',{...full,username:'bad_profile',emergencyProfile:{...emergencyProfile,contactConsent:false}});
    assert.equal(bad.status,400);assert.match(bad.data.error,/agreed/);
    assert.equal((await db.query("select id from eligtas.users where username='bad_profile'")).rows.length,0);
  });
  await t.test('profile edits validate optional data and cannot change another account',async()=>{
    for(const input of [{phone:'-------'},{email:'invalid'},{province:'x'.repeat(81)},{emergencyProfile:{...emergencyProfile,ageRange:'exact-birth-date'}},{emergencyProfile:{...emergencyProfile,shareWithOperators:'yes'}},{emergencyProfile:{...emergencyProfile,assistanceNeeds:['unknown']}},{emergencyProfile:{...emergencyProfile,emergencyContact:{name:'Only a name',phone:'',relationship:''}}}]){
      assert.equal((await person('/profile',{name:full.name,...input},'PUT')).status,400);
    }
    assert.equal((await person('/profile',{name:full.name,role:'admin',userId:(await owner('/state')).data.user.id},'PUT')).status,200);
    assert.equal((await person('/state')).data.user.role,'resident');assert.equal((await owner('/state')).data.user.name,'Test Owner');
  });
  await t.test('emergency-contact access is approved by its owner and scoped to requesting admin',async()=>{
    assert.equal((await other('/contact-requests',{userId:id,reason:'Test request',fields:['emergencyContact']})).status,403);
    const request=await owner('/contact-requests',{userId:id,reason:'Test emergency coordination',fields:['emergencyContact']});assert.equal(request.status,201);requestId=request.data.id;
    assert.equal((await other(`/contact-requests/${requestId}`,{status:'approved'},'PATCH')).status,404);
    assert.equal((await person(`/contact-requests/${requestId}`,{status:'approved'},'PATCH')).status,200);
    const found=(await owner('/state')).data.users.find(u=>u.id===id);assert.deepEqual(found.emergencyContact,emergencyProfile.emergencyContact);assert.notEqual(found.phone,full.phone);
  });
  await t.test('changed emergency contacts revoke existing and pending visibility approvals',async()=>{
    const changed={...emergencyProfile,emergencyContact:{...emergencyProfile.emergencyContact,phone:'+639170000003'}};
    assert.equal((await person('/profile',{name:full.name,emergencyProfile:changed},'PUT')).status,200);
    const found=(await owner('/state')).data.users.find(u=>u.id===id);assert.notEqual(found.emergencyContact.phone,changed.emergencyContact.phone);
    assert.equal((await person('/state')).data.contactRequests.find(r=>r.id===requestId).status,'revoked');
    const pending=await owner('/contact-requests',{userId:id,reason:'Test changed contact',fields:['emergencyContact']});
    assert.equal((await person('/profile',{name:full.name,emergencyProfile},'PUT')).status,200);
    assert.equal((await person(`/contact-requests/${pending.data.id}`,{status:'approved'},'PATCH')).status,409);
  });
  await t.test('turning off profile sharing removes demographic targeting and operator visibility',async()=>{
    assert.equal((await person('/profile',{name:full.name,emergencyProfile:{...emergencyProfile,shareWithOperators:false}},'PUT')).status,200);
    const mine=(await person('/state')).data.user;assert.equal(mine.emergencyProfile.pwdStatus,'yes');assert.deepEqual(mine.groups,[]);
    const found=(await owner('/state')).data.users.find(u=>u.id===id);assert.equal(found.emergencyProfile,null);assert.deepEqual(found.groups,[]);
  });
  await t.test('legacy updates preserve stored details and schema reapplication preserves accounts',async()=>{
    assert.equal((await person('/profile',{name:'Updated Preferred Name',municipality:'Cainta',groups:['pwd','seniors']},'PUT')).status,200);
    const before=(await person('/state')).data.user;assert.equal(before.emergencyProfile.pwdStatus,'yes');assert.deepEqual(before.groups,[]);assert.equal(before.province,'Rizal');
    await db.exec(schema);
    const after=(await person('/state')).data.user;assert.deepEqual(after.emergencyProfile,before.emergencyProfile);assert.equal(after.id,id);
    const audit=(await owner('/audit')).data;const encoded=JSON.stringify(audit);
    assert.ok(!encoded.includes(full.phone));assert.ok(!encoded.includes(emergencyProfile.emergencyContact.name));
  });
});
