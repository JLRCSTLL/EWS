import test from 'node:test';
import assert from 'node:assert/strict';
import { commandNotifications } from '../src/app/lib/command-notifications.ts';
test('command bell uses connected records, orders updates, and tracks request status separately', () => {
  assert.deepEqual(commandNotifications(null),[]);
  const state={users:[{id:'p',name:'Field 1',safeAt:'2026-10-25T08:00:00Z'}],requests:[{id:'r',name:'Field 2',type:'assistance',status:'new',created_at:'2026-10-25T09:00:00Z'}],alerts:[{id:'a',content:'Test instruction',priority:'high',created_at:'2026-10-25T07:00:00Z'}]};
  const items=commandNotifications(state);
  assert.deepEqual(items.map(i=>i.kind),['request','safe','broadcast']);
  assert.equal(items[0].destination,'public');
  assert.equal(items[2].destination,'broadcast');
  const before=items[0].id;
  state.requests[0].status='resolved';
  assert.notEqual(commandNotifications(state)[0].id,before);
  assert.match(commandNotifications(state)[0].detail,/resolved/);
});
