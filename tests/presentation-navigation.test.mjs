import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationPresentation, navigationReducer as reduce, ambulanceDemoRoute, demoIncident, demoShelters, demoJourneySeconds, nearestDemoShelter, routePosition, routeMeters } from '../src/app/lib/presentation-navigation.ts';

test('receipt of an ambulance dispatch opens its incident route without a phone action', () => {
  const original = createNavigationPresentation('mobile-responder');
  assert.equal(reduce(original, { type: 'tick', seconds: 5 }), original);
  const delivered = reduce(original, { type: 'receive-alert' });
  assert.equal(delivered.delivered, true);
  assert.deepEqual(delivered.route, ambulanceDemoRoute);
  assert.deepEqual(delivered.route.points.at(-1), demoIncident.point);
  assert.equal(delivered.progress, 0);
  assert.equal(original.route, null);
  const moving = reduce(delivered, { type: 'tick', seconds: 8 });
  assert.ok(moving.progress > 0);
  assert.equal(reduce(moving, { type: 'receive-alert' }), moving);
});

test('an evacuation alert opens the shortest available sample shelter route, excluding closed and full centers', () => {
  assert.ok(routeMeters(demoShelters[0]) < routeMeters(nearestDemoShelter()));
  assert.equal(nearestDemoShelter().id, 'demo-gym');
  const state = reduce(createNavigationPresentation('mobile-evacuation'), { type: 'receive-alert' });
  assert.equal(state.route.id, 'demo-gym');
  assert.equal(state.route.mode, 'walk');
  assert.equal(nearestDemoShelter([...demoShelters].reverse()).id, 'demo-gym');
  const fullGym = demoShelters.map(shelter => shelter.id === 'demo-gym' ? { ...shelter, spaces: 0 } : shelter);
  assert.equal(nearestDemoShelter(fullGym).id, 'demo-civic');
  assert.equal(nearestDemoShelter(demoShelters.map(shelter => ({ ...shelter, open: false }))), null);
  assert.equal(nearestDemoShelter([]), null);
});

test('navigation follows the route, arrives precisely once, and resets for the next loop', () => {
  for (const chapter of ['mobile-responder', 'mobile-evacuation']) {
    const start = reduce(createNavigationPresentation(chapter), { type: 'receive-alert' });
    const halfway = reduce(start, { type: 'tick', seconds: demoJourneySeconds / 2 });
    assert.equal(halfway.progress, .5);
    const before = routePosition(start.route, 0);
    const middle = routePosition(start.route, .5);
    assert.notDeepEqual(middle.point, before.point);
    assert.ok(middle.remainingMeters < before.remainingMeters);
    assert.ok(middle.turnMeters >= 0);
    const arrived = reduce(halfway, { type: 'tick', seconds: demoJourneySeconds });
    assert.equal(arrived.progress, 1);
    assert.deepEqual(routePosition(arrived.route, 1).point, arrived.route.points.at(-1));
    assert.equal(routePosition(arrived.route, 1).remainingMeters, 0);
    assert.equal(reduce(arrived, { type: 'tick', seconds: 2 }), arrived);
    assert.deepEqual(createNavigationPresentation(chapter), { chapter, delivered: false, route: null, progress: 0 });
    for (const seconds of [NaN, Infinity, -1, 0]) assert.equal(reduce(start, { type: 'tick', seconds }), start);
  }
});
