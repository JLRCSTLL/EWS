import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeAlert, addRequest, checkInSafe, emptyPublicState, isOpenRequest, parsePublicState, publicInbox, publicProfiles, updateRequest } from '../src/app/lib/public-demo.ts';
import { createAudienceSnapshot, demoGeofences, demoResidents, demoSnapshotAt } from '../src/app/lib/residents.ts';

const at = '2026-10-19T05:00:00.000Z';
const later = '2026-10-19T05:01:00.000Z';
const juan = publicProfiles[0].resident;
const ana = publicProfiles[1].resident;
const request = (changes = {}) => ({ id: 'help-demo-1', residentId: juan.id, type: 'Evacuation', note: 'Sample request', people: 2, location: { lat: 14.65, lng: 121.12 }, status: 'new', createdAt: at, updatedAt: at, ...changes });

test('public inbox follows the saved geographic and group recipient snapshot', () => {
  for (const profile of publicProfiles) {
    const area = demoGeofences.find(area => area.id === profile.areaId);
    const audience = createAudienceSnapshot(demoResidents, area, { groups: ['pwd'], activeOnly: true }, demoSnapshotAt);
    const message = { id: area.id, content: 'Sample targeted alert', createdAt: at, status: 'delivered', audience };
    assert.equal(publicInbox([message], profile.resident.id).length, 1);
    for (const other of publicProfiles.filter(item => item !== profile)) {
      assert.equal(publicInbox([message], other.resident.id).length, 0);
    }
  }
});

test('public inbox excludes sending, failed, legacy and non-demo deliveries', () => {
  const message = { id: 'message-1', content: 'Sample', createdAt: at, status: 'delivered', audience: { mode: 'demo', recipientIds: [juan.id] } };
  const messages = [null, { ...message, id: 'queued', status: 'sending' }, { ...message, id: 'failed', status: 'failed' }, { ...message, id: 'legacy', audience: undefined }, { ...message, id: 'live', audience: { ...message.audience, mode: 'live' } }, message, { ...message, id: 'newer', createdAt: later }];
  assert.deepEqual(publicInbox(messages, juan.id).map(item => item.id), ['newer', 'message-1']);
  assert.equal(publicInbox(messages, ana.id).length, 0);
});

test('acknowledgments and check-ins deduplicate per resident and respect location choice', () => {
  let state = acknowledgeAlert(emptyPublicState, juan.id, 'message-1', at);
  state = acknowledgeAlert(state, juan.id, 'message-1', later);
  state = acknowledgeAlert(state, ana.id, 'message-1', later);
  assert.equal(state.acknowledgments.length, 2);
  state = checkInSafe(state, juan, true, at);
  assert.deepEqual(state.checkIns[0].location, { lat: juan.location.lat, lng: juan.location.lng });
  state = checkInSafe(state, ana, true, at);
  state = checkInSafe(state, juan, false, later);
  assert.equal(state.checkIns.length, 2);
  assert.equal(state.checkIns.find(item => item.residentId === juan.id).location, null);
  assert.equal(state.checkIns.find(item => item.residentId === juan.id).at, later);
  assert.deepEqual(emptyPublicState.checkIns, []);
});

test('request lifecycle prevents duplicates and cannot reopen a terminal request', () => {
  let state = addRequest(emptyPublicState, request());
  state = addRequest(state, request({ id: 'duplicate' }));
  assert.equal(state.requests.length, 1);
  state = updateRequest(state, 'help-demo-1', 'acknowledged', later);
  assert.equal(state.requests[0].status, 'acknowledged');
  state = updateRequest(state, 'help-demo-1', 'assigned', later, 'Unknown unit');
  assert.equal(state.requests[0].status, 'acknowledged');
  state = updateRequest(state, 'help-demo-1', 'assigned', later, 'Ambulance Bravo');
  assert.equal(state.requests[0].unit, 'Ambulance Bravo');
  state = updateRequest(state, 'help-demo-1', 'acknowledged', later);
  assert.equal(state.requests[0].status, 'assigned');
  state = updateRequest(state, 'help-demo-1', 'resolved', later);
  assert.equal(isOpenRequest(state.requests[0]), false);
  state = updateRequest(state, 'help-demo-1', 'assigned', later, 'Rescue Alpha');
  assert.equal(state.requests[0].status, 'resolved');
  state = addRequest(state, request({ id: 'help-demo-2', location: null }));
  state = updateRequest(state, 'help-demo-2', 'cancelled', later);
  assert.equal(state.requests.length, 2);
  assert.equal(state.requests[0].location, null);
  assert.equal(isOpenRequest(state.requests[0]), false);
});

test('browser state rejects malformed records without losing valid demo records', () => {
  for (const raw of [null, 'broken json', 'null', '42']) assert.deepEqual(parsePublicState(raw), emptyPublicState);
  const valid = request();
  const state = parsePublicState(JSON.stringify({
    requests: [valid, request({ residentId: 'unknown' }), request({ people: 0 }), request({ location: { lat: 999, lng: 0 } }), request({ status: 'not-a-status' }), request({ note: 'x'.repeat(301) })],
    checkIns: [{ residentId: juan.id, at, location: null }, { residentId: juan.id, at: 'invalid', location: null }],
    acknowledgments: [{ residentId: juan.id, messageId: 'message-1', at }, { residentId: 'unknown', messageId: 'message-1', at }],
    preferences: [{ residentId: juan.id, shareLocation: false }, { residentId: ana.id, shareLocation: 'yes' }],
  }));
  assert.deepEqual(state.requests, [valid]);
  assert.equal(state.checkIns.length, 1);
  assert.equal(state.acknowledgments.length, 1);
  assert.deepEqual(state.preferences, [{ residentId: juan.id, shareLocation: false }]);
});
