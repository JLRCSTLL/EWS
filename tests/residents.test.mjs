import test from 'node:test';
import assert from 'node:assert/strict';
import { isPointInGeofence } from '../src/app/lib/geofencing.ts';
import { createAudienceSnapshot, demoGeofences, demoResidents, demoSnapshotAt, getAudience, getExposure } from '../src/app/lib/residents.ts';

const at = '2026-10-17T04:00:00.000Z';
const rectangle = { shape: 'rectangle', points: [{ lat: 14.6, lng: 121 }, { lat: 14.62, lng: 121.02 }] };
const user = (id, changes = {}, location = {}) => ({
  id, name: id, age: 30, pwd: false, pregnant: false, responder: false, notificationsEnabled: true,
  location: { lat: 14.61, lng: 121.01, accuracy: 10, updatedAt: '2026-10-17T03:59:00Z', ...location }, ...changes,
});
const users = [
  user('child-pwd', { age: 12, pwd: true }), user('senior', { age: 65 }),
  user('pregnant', { pregnant: true }), user('responder', { responder: true }),
  user('outside', { age: 10 }, { lat: 14.7 }), user('no-location', { location: null }),
  user('stale', { pwd: true }, { updatedAt: '2026-10-17T02:59:00Z' }),
  user('recent', { pwd: true }, { updatedAt: '2026-10-17T03:00:00Z' }),
  user('notifications-off', { notificationsEnabled: false }),
  user('five-minutes', {}, { updatedAt: '2026-10-17T03:55:00Z' }),
];

test('containment supports circles, rectangles, and concave polygons including boundary points', () => {
  assert.equal(isPointInGeofence({ lat: 14.61, lng: 121.01 }, rectangle), true);
  assert.equal(isPointInGeofence(rectangle.points[0], rectangle), true);
  assert.equal(isPointInGeofence({ lat: 14.7, lng: 121.01 }, rectangle), false);
  const circle = { shape: 'circle', points: [{ lat: 0, lng: 0 }, { lat: 0, lng: .01 }] };
  assert.equal(isPointInGeofence(circle.points[0], circle), true);
  assert.equal(isPointInGeofence(circle.points[1], circle), true);
  assert.equal(isPointInGeofence({ lat: .02, lng: 0 }, circle), false);
  const polygon = { shape: 'polygon', points: [[0, 0], [0, 2], [1, 1], [2, 2], [2, 0]].map(([lat, lng]) => ({ lat, lng })) };
  for (const points of [polygon.points, [...polygon.points].reverse()]) {
    assert.equal(isPointInGeofence({ lat: 1, lng: .5 }, { ...polygon, points }), true);
    assert.equal(isPointInGeofence({ lat: 1, lng: 1.5 }, { ...polygon, points }), false);
    assert.equal(isPointInGeofence({ lat: 1, lng: 1 }, { ...polygon, points }), true);
  }
});

test('exposure counts unique located users and overlapping demographic groups inside the area', () => {
  const result = getExposure([...users, users[0]], rectangle, at);
  assert.equal(result.total, 8);
  assert.equal(result.active, 6);
  assert.equal(result.stale, 1);
  assert.equal(result.unavailable, 1);
  assert.deepEqual(result.counts, { pwd: 3, children: 1, seniors: 1, pregnant: 1, responders: 1 });
});

test('multiple groups use OR and do not send twice to an overlapping recipient', () => {
  const result = getAudience(users, rectangle, { groups: ['pwd', 'children'], activeOnly: true }, at);
  assert.deepEqual(result.recipients.map(user => user.id), ['child-pwd']);
  assert.equal(result.matched.length, 3);
  assert.equal(result.excluded, 2);
});

test('notification eligibility and location freshness are enforced for area and all-users broadcasts', () => {
  const active = getAudience(users, rectangle, { groups: ['all'], activeOnly: true }, at);
  assert.equal(active.recipients.length, 5);
  const recent = getAudience(users, rectangle, { groups: ['all'], activeOnly: false }, at);
  assert.equal(recent.recipients.length, 6);
  assert.ok(recent.recipients.some(user => user.id === 'recent'));
  assert.ok(!recent.recipients.some(user => ['stale', 'no-location', 'outside', 'notifications-off'].includes(user.id)));
  assert.equal(getAudience(users, null, { groups: ['all'], activeOnly: true }, at).recipients.length, 6);
});

test('invalid coordinates, timestamps, incomplete boundaries, and empty filters cannot produce recipients', () => {
  const invalidUsers = [user('nan', {}, { lat: NaN }), user('out-of-range', {}, { lng: 500 }), user('invalid-time', {}, { updatedAt: 'yesterday' })];
  assert.equal(getAudience(invalidUsers, null, { groups: ['all'], activeOnly: false }, at).recipients.length, 0);
  const draft = { shape: 'polygon', points: rectangle.points };
  assert.equal(getExposure(users, draft, at).valid, false);
  assert.equal(getExposure(users, draft, at).total, 0);
  assert.throws(() => createAudienceSnapshot(users, draft, { groups: ['all'], activeOnly: true }, at));
  assert.throws(() => createAudienceSnapshot(users, rectangle, { groups: [], activeOnly: true }, at));
  assert.throws(() => createAudienceSnapshot(users, rectangle, { groups: ['unknown'], activeOnly: true }, at));
  assert.throws(() => createAudienceSnapshot([], rectangle, { groups: ['all'], activeOnly: true }, at));
});

test('sent audience snapshots preserve exact IDs and group filters after subsequent edits', () => {
  const filter = { groups: ['pwd', 'children'], activeOnly: false };
  const snapshot = createAudienceSnapshot(users, rectangle, filter, at);
  assert.deepEqual(snapshot.recipientIds, ['child-pwd', 'recent']);
  assert.equal(snapshot.activeCount, 1);
  assert.equal(snapshot.excludedCount, 1);
  filter.groups.push('all');
  filter.activeOnly = true;
  assert.deepEqual(snapshot.groups, ['pwd', 'children']);
  assert.equal(snapshot.activeOnly, false);
  assert.equal(snapshot.locationSnapshotAt, at);
});

test('each demo area has residents, priority groups, and eligible recipients', () => {
  for (const area of demoGeofences) {
    const exposure = getExposure(demoResidents, area, demoSnapshotAt);
    assert.ok(exposure.total > 0, area.name);
    assert.ok(exposure.counts.children > 0 && exposure.counts.pwd > 0, area.name);
    const filter = { groups: ['all'], activeOnly: true };
    const preview = getAudience(demoResidents, area, filter, demoSnapshotAt);
    const sent = createAudienceSnapshot(demoResidents, area, filter, demoSnapshotAt);
    assert.deepEqual(sent.recipientIds, preview.recipients.map(user => user.id));
  }
});
