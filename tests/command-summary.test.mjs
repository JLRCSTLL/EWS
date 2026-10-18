import test from 'node:test';
import assert from 'node:assert/strict';
import { getAlertReach, getAreaBroadcasts } from '../src/app/lib/command-summary.ts';
import { demoGeofences, demoResidents, demoSnapshotAt, getAudience } from '../src/app/lib/residents.ts';

test('sidebar eligible totals, group shortcuts, and recent-location expansion match the composer', () => {
  for (const area of [...demoGeofences, null]) {
    const reach = getAlertReach(demoResidents, area, demoSnapshotAt);
    const expanded = getAudience(demoResidents, area, { groups: ['all'], activeOnly: false }, demoSnapshotAt);
    assert.equal(reach.recipients.length + reach.recentEligible, expanded.recipients.length);
    assert.ok(reach.recipients.length <= reach.active);
    for (const group of reach.groups) {
      const preview = getAudience(demoResidents, area, { groups: [group.id], activeOnly: true }, demoSnapshotAt);
      assert.equal(group.eligible, preview.recipients.length);
    }
  }
});

test('reach gaps respect the boundary and deduplicate users; missing locations remain global', () => {
  const at = '2026-10-18T02:00:00Z';
  const area = demoGeofences[0];
  const base = { id: 'active', name: 'Sample', age: 30, pwd: true, pregnant: false, responder: false, notificationsEnabled: true, location: { ...area.points[0], accuracy: 10, updatedAt: at } };
  const off = { ...base, id: 'off', notificationsEnabled: false };
  const recent = { ...base, id: 'recent', location: { ...base.location, updatedAt: '2026-10-18T01:40:00Z' } };
  const stale = { ...base, id: 'stale-off', notificationsEnabled: false, location: { ...base.location, updatedAt: '2026-10-18T00:00:00Z' } };
  const users = [base, base, off, recent, stale, { ...off, id: 'outside', location: { ...off.location, lat: 16 } }, { ...base, id: 'missing', location: null }];
  const reach = getAlertReach(users, area, at);
  assert.equal(reach.total, 4);
  assert.equal(reach.recipients.length, 1);
  assert.equal(reach.recentEligible, 1);
  assert.equal(reach.notificationsOff, 2);
  assert.equal(reach.stale, 1);
  assert.equal(reach.unavailable, 1);
  assert.equal(reach.groups.find(group => group.id === 'pwd').eligible, 1);
});

test('incomplete and empty boundaries never display an eligible audience', () => {
  const invalid = getAlertReach(demoResidents, { shape: 'polygon', points: [] }, demoSnapshotAt);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.recipients.length, 0);
  assert.equal(invalid.recentEligible, 0);
  const empty = getAlertReach([], demoGeofences[0], demoSnapshotAt);
  assert.equal(empty.valid, true);
  assert.equal(empty.total, 0);
  assert.ok(empty.groups.every(group => group.eligible === 0));
});

test('latest broadcasts exclude legacy estimates and other areas, sort newest first, and preserve history order', () => {
  const message = (id, area, minute, app = true) => ({ id, geofence: area ? { id: area } : undefined, createdAt: `2026-10-18T02:0${minute}:00Z`, audience: app ? { mode: 'demo', recipientIds: [] } : undefined });
  const messages = [message('older', 'manila', 1), message('other', 'qc', 5), message('newer', 'manila', 3), message('legacy', 'manila', 9, false), message('all-users', null, 4)];
  assert.deepEqual(getAreaBroadcasts(messages, 'manila').map(item => item.id), ['newer', 'older']);
  assert.deepEqual(getAreaBroadcasts(messages, null).map(item => item.id), ['other', 'all-users', 'newer', 'older']);
  assert.deepEqual(getAreaBroadcasts(messages, 'empty'), []);
  assert.equal(messages[0].id, 'older');
});
