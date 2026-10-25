import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../server/app.mjs';
import { activityCsv } from '../src/app/lib/activity-log.ts';

test('activity CSV escapes quotes, newlines, and spreadsheet formulas', () => {
  const csv = activityCsv([{createdAt:'2026-10-25T00:00:00Z',action:'Alert dispatched',category:'alerts',actor:' =SUM(1,2)',target:'Example "A"\nsecond line',reference:'ref'}]);
  assert.ok(csv.startsWith('\uFEFF"Time (UTC)"'));
  assert.ok(csv.includes('"\' =SUM(1,2)"'));
  assert.ok(csv.includes('"Example ""A""\nsecond line"'));
  assert.equal(activityCsv([]).split('\r\n').length,1);
});

test('command-center logs are authorized, private, searchable, and paginated', async t => {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../server/schema.sql',import.meta.url),'utf8'));
  const app = createApp(db,{allowedOrigins:['https://test.local'],bootstrapToken:'test-only-owner-setup'});
  const server = await new Promise(resolve => { const s=app.listen(0,'127.0.0.1',()=>resolve(s)); });
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  function client() {
    let cookie='';
    return async (path,body,method=body===undefined?'GET':'POST')=>{
      const response=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:'https://test.local',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
      return {status:response.status,data:await response.json()};
    };
  }
  const guest=client(), owner=client(), resident=client(), operator=client();
  const ids={};
  for(const [name,api] of Object.entries({owner,resident,operator})) {
    assert.equal((await api('/auth/register',{username:`logs_${name}`,name:`Preferred ${name}`,password:'isolated-log-test-password'})).status,201);
    ids[name]=(await api('/state')).data.user.id;
  }
  await owner('/operator/bootstrap',{token:'test-only-owner-setup'});
  await owner(`/operator/access/${ids.operator}`,{role:'operator'},'PUT');

  await t.test('only approved operators and admins can read logs',async()=>{
    assert.equal((await guest('/audit')).status,401);
    assert.equal((await resident('/audit')).status,403);
    const result=await operator('/audit');
    assert.equal(result.status,200);
    assert.ok(result.data.entries.some(entry=>entry.action==='Account owner configured'));
    assert.ok(result.data.entries.some(entry=>entry.action==='Operator access changed'&&entry.target==='Preferred operator'));
    assert.equal((await owner('/audit')).status,200);
  });

  const group=randomUUID(), alert=randomUUID();
  await db.query('insert into eligtas.team_groups(id,name,tag) values ($1,$2,$3)',[group,'River team 100%','river']);
  await db.query(`insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only,recipient_count,target_label)
    values ($1,$2,$3,'high',$4,'{}',false,1,'River team 100%')`,[alert,ids.owner,'PRIVATE ALERT TEXT',JSON.stringify({name:'Test area',shape:'circle',center:{lat:14.6,lng:121.1},radiusM:1000})]);
  await db.query('update eligtas.users set email=$1,phone=$2,location_sharing=true,lat=14.6,lng=121.1,accuracy=10,location_at=now() where id=$3',['private@example.test','09991234567',ids.owner]);
  const insert=async(action,target,at)=>db.query('insert into eligtas.audit(id,actor_id,action,target_id,created_at) values($1,$2,$3,$4,$5)',[randomUUID(),ids.owner,action,target,at]);
  await insert('create_group',group,'2026-01-01T01:00:00.000001Z');
  await insert('dispatch_alert',alert,'2026-01-02T01:00:00.000001Z');

  await t.test('category, preferred-name, literal search and time filters work',async()=>{
    const groups=await operator('/audit?category=groups&q=River');
    assert.equal(groups.data.entries.length,1);
    assert.equal(groups.data.entries[0].action,'Group created');
    assert.equal((await owner('/audit?q=100%25')).data.entries.length,2);
    assert.equal((await owner('/audit?q=no_such_record')).data.entries.length,0);
    assert.equal((await owner('/audit?q=Preferred%20owner')).data.entries.length,4);
    const recent=await owner('/audit?category=alerts&since=2026-01-02T00%3A00%3A00.000Z');
    assert.equal(recent.data.entries.length,1);
    assert.equal((await owner('/audit?category=groups&since=2026-01-02T00%3A00%3A00.000Z')).data.entries.length,0);
  });

  await t.test('logs expose no raw user, location, session, or message data',async()=>{
    const result=await owner('/audit');
    const serialized=JSON.stringify(result.data);
    for(const secret of ['private@example.test','09991234567','PRIVATE ALERT TEXT','password_hash','token_hash','14.6','121.1']) assert.ok(!serialized.includes(secret),secret);
    assert.deepEqual(Object.keys(result.data.entries[0]).sort(),['id','action','category','actor','target','reference','createdAt'].sort());
  });

  await t.test('invalid filters and cursors are rejected',async()=>{
    for(const query of ['category=unknown','since=bad','cursor=not-json','q='+ 'a'.repeat(101),'q=a&q=b','cursor='+encodeURIComponent(Buffer.from(JSON.stringify(['bad',ids.owner])).toString('base64url'))]) assert.equal((await owner('/audit?'+query)).status,400,query);
  });

  await t.test('older pages have no gaps or duplicates, including submillisecond timestamps',async()=>{
    for(let i=0;i<107;i++)await insert('update_group',group,`2026-02-01T00:00:00.000${String(Math.floor(i/2)).padStart(3,'0')}Z`);
    const seen=[];
    let cursor='';
    do {
      const result=await owner(`/audit?category=groups&cursor=${encodeURIComponent(cursor)}`);
      assert.equal(result.status,200);
      assert.ok(result.data.entries.length<=50);
      seen.push(...result.data.entries.map(entry=>entry.id));
      cursor=result.data.nextCursor;
    }while(cursor);
    assert.equal(seen.length,108); assert.equal(new Set(seen).size,108);
  });

  await t.test('revoking an operator removes log access immediately',async()=>{
    await owner(`/operator/access/${ids.operator}`,{role:'resident'},'PUT');
    assert.equal((await operator('/audit')).status,403);
  });
});
