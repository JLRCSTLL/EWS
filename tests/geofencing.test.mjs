import test from 'node:test';
import assert from 'node:assert/strict';
import { geofenceArea, geofenceDistance, getGeofenceError, isAlertGeofence } from '../src/app/lib/geofencing.ts';

const point = (lat, lng) => ({ lat, lng });
const square = [point(14.6, 121), point(14.6, 121.01), point(14.61, 121.01), point(14.61, 121)];

test('rectangle and polygon agree on the same boundary regardless of winding', () => {
  const rectangle = { shape: 'rectangle', points: [square[0], square[2]] };
  const polygon = { shape: 'polygon', points: square };
  assert.equal(getGeofenceError(rectangle), null);
  assert.equal(getGeofenceError(polygon), null);
  assert.ok(Math.abs(geofenceArea(rectangle) - geofenceArea(polygon)) < .01);
  assert.ok(Math.abs(geofenceArea(polygon) - geofenceArea({ ...polygon, points: [...square].reverse() })) < .01);
  assert.ok(geofenceArea(polygon) > 1_000_000 && geofenceArea(polygon) < 1_300_000);
});

test('circle uses a geographic radius and rejects a collapsed center/edge', () => {
  const circle = { shape: 'circle', points: [point(0, 0), point(0, .01)] };
  assert.equal(getGeofenceError(circle), null);
  assert.ok(Math.abs(geofenceDistance(...circle.points) - 1111.95) < 1);
  assert.ok(Math.abs(geofenceArea(circle) - 3_884_374) < 100);
  assert.ok(getGeofenceError({ shape: 'circle', points: [square[0], square[0]] }));
});

test('incomplete, degenerate, and crossing boundaries cannot be sent', () => {
  assert.ok(getGeofenceError({ shape: 'polygon', points: square.slice(0, 2) }));
  assert.ok(getGeofenceError({ shape: 'rectangle', points: [square[0], square[1]] }));
  assert.ok(getGeofenceError({ shape: 'polygon', points: [point(0, 0), point(0, 1), point(0, 2)] }));
  assert.match(getGeofenceError({ shape: 'polygon', points: [square[0], square[2], square[1], square[3]] }), /crosses/);
});

test('saved areas are validated before reuse and alert submission', () => {
  const area = { id: 'area-1', name: 'Evacuation zone', shape: 'polygon', points: square };
  assert.equal(isAlertGeofence(JSON.parse(JSON.stringify(area))), true);
  for (const value of [null, {}, { ...area, name: ' ' }, { ...area, points: null }, { ...area, shape: 'triangle' }, { ...area, points: [point(NaN, 0), ...square] }, { ...area, points: [point(90, 0), ...square] }]) {
    assert.equal(isAlertGeofence(value), false);
  }
});
