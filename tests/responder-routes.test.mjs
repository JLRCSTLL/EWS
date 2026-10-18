import test from 'node:test';
import assert from 'node:assert/strict';
import { responderTeams } from '../src/app/lib/dashboard-data.ts';
import { getRouteProgress, responderRoutes, routePosition, RESPONDER_DEMO_DURATION, formatRouteDistance } from '../src/app/lib/responder-routes.ts';
import { geofenceDistance } from '../src/app/lib/geofencing.ts';

test('each moving team has one valid cached road route, and the standby team stays stationary', () => {
  assert.equal(new Set(responderRoutes.map(route => route.teamId)).size, responderRoutes.length);
  for (const route of responderRoutes) {
    const team = responderTeams.find(team => team.id === route.teamId);
    assert.ok(team && team.status !== 'standby');
    assert.ok(route.points.length > 20);
    assert.ok(route.modelDurationSeconds > 0 && route.totalMeters > 0);
    assert.ok(geofenceDistance(team, route.points[0]) < 500);
    assert.ok(route.points.every(point => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
    assert.ok(route.cumulativeMeters.every((distance, index, all) => !index || distance > all[index - 1]));
    assert.ok(Math.abs(route.totalMeters - route.distanceMeters) / route.distanceMeters < .02);
  }
  assert.ok(!responderRoutes.some(route => route.teamId === 'team-4'));
  assert.equal(responderRoutes.filter(route => route.vehicle === 'ambulance').length, 2);
});

test('ambulance hospital route ends at the named hospital and has a distinct return-to-base route', () => {
  const hospital = responderRoutes.find(route => route.teamId === 'team-2');
  assert.equal(hospital.destination, 'Manila General Hospital');
  assert.ok(geofenceDistance(hospital.points.at(-1), { lat: 14.5793, lng: 120.9757 }) < 500);
  assert.equal(responderRoutes.find(route => route.teamId === 'team-6').destination, 'Central Command');
});

test('distance-based interpolation stays on each road segment, including at endpoints', () => {
  for (const route of responderRoutes) {
    assert.deepEqual(routePosition(route, 0).position, route.points[0]);
    assert.deepEqual(routePosition(route, 1).position, route.points.at(-1));
    const index = Math.floor(route.points.length / 2);
    const midpointDistance = (route.cumulativeMeters[index - 1] + route.cumulativeMeters[index]) / 2;
    const state = routePosition(route, midpointDistance / route.totalMeters);
    const a = route.points[index - 1];
    const b = route.points[index];
    assert.ok(Math.abs(state.position.lat - (a.lat + b.lat) / 2) < 1e-9);
    assert.ok(Math.abs(state.position.lng - (a.lng + b.lng) / 2) < 1e-9);
    assert.ok(state.heading >= 0 && state.heading < 360);
    assert.deepEqual(state.remainingPoints.at(-1), route.points.at(-1));
  }
});

test('trips advance monotonically and stop at their destination without overshooting', () => {
  for (const route of responderRoutes) {
    const before = getRouteProgress(route, 5);
    const after = getRouteProgress(route, 10);
    assert.ok(after.progress > before.progress);
    assert.ok(after.remainingMeters < before.remainingMeters);
    assert.ok(after.remainingSeconds < before.remainingSeconds);
    const arrived = getRouteProgress(route, RESPONDER_DEMO_DURATION);
    assert.equal(arrived.progress, 1);
    assert.equal(arrived.arrived, true);
    assert.equal(arrived.remainingMeters, 0);
    assert.equal(arrived.remainingSeconds, 0);
    assert.deepEqual(arrived.position, route.points.at(-1));
    assert.deepEqual(getRouteProgress(route, -20), getRouteProgress(route, 0));
  }
});

test('distance labels switch units without reporting negative remaining distance', () => {
  assert.equal(formatRouteDistance(0), '0 m');
  assert.equal(formatRouteDistance(412), '412 m');
  assert.equal(formatRouteDistance(1250), '1.3 km');
});
