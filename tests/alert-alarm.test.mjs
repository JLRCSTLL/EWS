import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createAlertTracker } from '../src/app/lib/alert-alarm.ts';

const now = Date.parse('2026-10-22T08:00:00Z');
const alert = (id, extra = {}) => ({ id, priority:'high', created_at: new Date(now).toISOString(), read_at:null, ...extra });
test('opening an inbox does not replay history; new arrivals alarm only once across receipt refreshes', () => {
  const track = createAlertTracker();
  assert.deepEqual(track([alert('old')],now),[]);
  assert.deepEqual(track([alert('new'),alert('old')],now).map(a => a.id),['new']);
  assert.deepEqual(track([alert('new',{received_at:new Date(now).toISOString()}),alert('old')],now),[]);
  assert.deepEqual(track([],now),[]);
  assert.deepEqual(track([alert('new')],now),[]);
});
test('expired, already-read, malformed and future alerts cannot start an alarm', () => {
  const track = createAlertTracker(); track([],now);
  assert.deepEqual(track([alert('stale',{created_at:new Date(now-300001).toISOString()}),alert('read',{read_at:new Date(now).toISOString()}),alert('bad',{created_at:'invalid'}),alert('future',{created_at:new Date(now+120000).toISOString()})],now),[]);
});
test('a burst presents the most urgent incoming alert first without replaying lower priorities', () => {
  const track = createAlertTracker(); track([],now);
  const arrivals = [alert('normal',{priority:'normal'}),alert('critical',{priority:'critical'}),alert('high')];
  assert.deepEqual(track(arrivals,now).map(a => a.id),['critical','high','normal']);
  assert.deepEqual(track(arrivals,now),[]);
});
test('web push requests audible urgent notifications and refreshes only public-app clients', async () => {
  const handlers = {}, notifications = [], messages = [];
  const context = { URL, console, self: { location:{origin:'https://test.local'}, addEventListener:(type,fn) => handlers[type]=fn,
    registration:{showNotification:async (...args) => notifications.push(args)}, clients:{matchAll:async () => [
      {url:'https://test.local/#/public',postMessage:value => messages.push(value)},
      {url:'https://test.local/#/command',postMessage:() => assert.fail('command center must not trigger resident alarm')},
      {url:'https://other.example/#/public',postMessage:() => assert.fail('wrong origin')},
    ]} } };
  vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  let done;
  handlers.push({data:{json:() => ({id:'test',title:'TEST',body:'No emergency',priority:'critical'})},waitUntil:promise => done=promise});
  await done;
  assert.equal(notifications[0][1].silent,false); assert.equal(notifications[0][1].requireInteraction,true);
  assert.ok(notifications[0][1].vibrate.length > 1); assert.equal(messages[0].type,'ELIGTAS_ALERT');
});
