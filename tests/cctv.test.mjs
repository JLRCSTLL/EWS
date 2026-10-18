import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCameras, filterCameras } from '../src/app/lib/cctv.ts';

test('camera search combines category, location and pending review without losing other feeds', () => {
  const reviewed = new Set(['CAM-01']);
  assert.equal(filterCameras(demoCameras, 'flood', '  MARIKINA  ', false, reviewed).length, 1);
  assert.equal(filterCameras(demoCameras, 'flood', 'Marikina', true, reviewed).length, 0);
  assert.deepEqual(filterCameras(demoCameras, 'all', '', true, reviewed).map(camera => camera.id), ['CAM-02', 'CAM-03']);
  assert.equal(filterCameras(demoCameras, 'all', '', false, reviewed).length, 6);
});

test('operators can search by camera ID and get an empty result for unmatched locations', () => {
  assert.equal(filterCameras(demoCameras, 'all', 'cam-03', false, new Set())[0].category, 'accidents');
  assert.equal(filterCameras(demoCameras, 'traffic', 'cam-03', false, new Set()).length, 0);
  assert.equal(filterCameras(demoCameras, 'all', 'nonexistent camera', false, new Set()).length, 0);
});
