import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { digest } from '../server/auth.mjs';

test('account deletion requires the owner password, removes linked data, and revokes every device', async t => {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const server = await new Promise(resolve => { const s = createApp(db, {allowedOrigins:['http://account.test']}).listen(0,'127.0.0.1',() => resolve(s)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const password = 'isolated-account-password';
  const client = () => {
    let cookie = '';
    const send = async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
      const res = await fetch(base+path, {method, headers:{Origin:'http://account.test',Cookie:cookie,'Content-Type':'application/json',...extra}, body:body === undefined ? undefined : JSON.stringify(body)});
      if(res.headers.get('set-cookie')) cookie=res.headers.get('set-cookie').split(';')[0];
      return {status:res.status, data:await res.json()};
    };
    return {send, session:()=>cookie.split('=')[1]};
  };
  const owner=client(), other=client(), second=client(), anonymous=client();
  for(const [client,username] of [[owner,'delete_owner'],[other,'keep_other']])
    assert.equal((await client.send('/auth/register',{username,name:username,password})).status,201);
  const a=(await owner.send('/state')).data.user.id, b=(await other.send('/state')).data.user.id;
  const recovery=(await db.query('select recovery_hash from eligtas.users where id=$1',[a])).rows[0].recovery_hash;
  await second.send('/auth/login',{username:'delete_owner',password});
  const oldCookie=second.session();
  await owner.send('/duty',{onDuty:true},'PUT');
  const native=(await owner.send('/location/share',{})).data.token;
  await owner.send('/location',{lat:14.65,lng:121.11,accuracy:15},'PUT');
  await db.query("update eligtas.users set role='operator',email='test@example.invalid',phone='+630000000000' where id=$1",[a]);
  const project=randomUUID(), group=randomUUID(), task=randomUUID(), authored=randomUUID(), retained=randomUUID();
  await db.query("insert into eligtas.projects(id,name,lead_id) values($1,'Test project',$2)",[project,a]);
  await db.query("insert into eligtas.team_groups(id,name,tag,head_id,project_id) values($1,'Test group','testgroup',$2,$3)",[group,a,project]);
  await db.query('insert into eligtas.group_members(group_id,user_id) values($1,$2),($1,$3)',[group,a,b]);
  await db.query("insert into eligtas.tasks(id,project_id,title,assignee_id) values($1,$2,'Test task',$3)",[task,project,a]);
  await db.query("insert into eligtas.contact_requests(id,user_id,requester_id,reason,fields) values($1,$2,$3,'Test consent',array['email'])",[randomUUID(),a,b]);
  for(const [id,author] of [[authored,a],[retained,b]]) {
    await db.query("insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only) values($1,$2,'TEST ONLY','high','{}','{}',false)",[id,author]);
    await db.query('insert into eligtas.receipts(alert_id,user_id) values($1,$2),($1,$3)',[id,a,b]);
  }
  await db.query("insert into eligtas.audit(id,actor_id,action,target_id) values($1,$2,'test',$3)",[randomUUID(),b,a]);
  await db.query("insert into eligtas.requests(id,user_id,type,note,people) values($1,$2,'Other assistance','Test only',1)",[randomUUID(),a]);
  await db.query("insert into eligtas.push_subscriptions(endpoint,user_id,subscription) values('https://example.invalid/test',$1,'{}')",[a]);
  for(const platform of ['ios','android']) {
    await db.query(`insert into eligtas.${platform}_devices(token,user_id,session_hash${platform==='ios'?',environment':''}) values($1,$2,$3${platform==='ios'?",'sandbox'":''})`,['a'.repeat(64),a,digest(owner.session())]);
  }
  await db.query('insert into eligtas.ios_activities(token,device_token,alert_id) values($1,$2,$3)',['b'.repeat(64),'a'.repeat(64),retained]);

  assert.equal((await anonymous.send('/account',{password,confirm:true},'DELETE')).status,401);
  assert.equal((await owner.send('/account',{password},'DELETE')).status,400);
  assert.equal((await owner.send('/account',{password:'wrong',confirm:true},'DELETE')).status,403);
  assert.equal((await owner.send('/account',{password,confirm:true},'DELETE', {Origin:'https://other.invalid'})).status,403);
  assert.equal((await db.query('select id from eligtas.users where id=$1',[a])).rows.length,1);

  const result=await owner.send('/account',{password,confirm:true,userId:b},'DELETE');
  assert.equal(result.status,200); assert.equal(result.data.deleted,true);
  assert.equal((await other.send('/state')).status,200);
  assert.equal((await second.send('/state')).status,401);
  assert.equal((await anonymous.send('/auth/login',{username:'delete_owner',password})).status,401);
  for(const table of ['users','sessions','location_shares','receipts','requests','push_subscriptions','android_devices','ios_devices','group_members']) {
    const column=table==='users'?'id':'user_id';
    assert.equal((await db.query(`select * from eligtas.${table} where ${column}=$1`,[a])).rows.length,0,table);
  }
  assert.equal((await db.query('select * from eligtas.ios_activities')).rows.length,0);
  assert.equal((await db.query('select * from eligtas.contact_requests')).rows.length,0);
  assert.equal((await db.query('select * from eligtas.audit')).rows.length,0);
  assert.equal((await db.query('select id from eligtas.alerts where id=$1',[authored])).rows.length,0);
  assert.equal((await db.query('select id from eligtas.alerts where id=$1',[retained])).rows.length,1);
  assert.equal((await db.query('select lead_id from eligtas.projects')).rows[0].lead_id,null);
  assert.equal((await db.query('select head_id from eligtas.team_groups')).rows[0].head_id,null);
  assert.equal((await db.query('select assignee_id from eligtas.tasks')).rows[0].assignee_id,null);
  assert.equal((await db.query('select id from eligtas.users where recovery_hash=$1',[recovery])).rows.length,0);
  const upload=await fetch(base+'/location/native',{method:'PUT',headers:{Origin:'http://account.test','Content-Type':'application/json',Authorization:'Bearer '+native},body:JSON.stringify({lat:14.65,lng:121.11,accuracy:10})});
  assert.equal(upload.status,401);
  const oldSession=await fetch(base+'/state',{headers:{Cookie:'eligtas_session='+oldCookie}});assert.equal(oldSession.status,401);
});
