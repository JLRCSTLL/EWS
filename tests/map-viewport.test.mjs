import test from 'node:test';
import assert from 'node:assert/strict';
import { mapViewport, responderMapInsets } from '../src/app/lib/map-viewport.ts';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
function markerPosition(view, overlays) {
  const insets = responderMapInsets(view, overlays);
  const camera = mapViewport(view.width, view.height, insets);
  return { x: view.left + view.width / 2 - camera.centerOffset[0], y: view.top + view.height / 2 - camera.centerOffset[1], camera };
}

test('portrait follow and recenter leave the entire vehicle above a tall standby card', () => {
  const view = rect(0, 55, 393, 700), top = rect(20, 140, 353, 54), sheet = rect(10, 378, 373, 365);
  const marker = markerPosition(view, [{ edge: 'top', rect: top }, { edge: 'sheet', rect: sheet }]);
  assert.ok(marker.y - 24 > top.bottom);
  assert.ok(marker.y + 24 < sheet.top, 'vehicle must be fully visible, not behind the sheet');
  assert.equal(marker.x, 196.5);
});

test('landscape centers in the left map area beside the side sheet', () => {
  const view = rect(30, 0, 680, 390), top = rect(44, 12, 640, 58), sheet = rect(370, 80, 330, 298);
  const marker = markerPosition(view, [{ edge: 'top', rect: top }, { edge: 'sheet', rect: sheet }]);
  assert.ok(marker.x + 24 < sheet.left);
  assert.ok(marker.y - 24 > top.bottom);
  assert.ok(marker.camera.paddingBottomRight[0] > 300);
});

test('expanding a card moves the followed marker up; collapsing it restores map space', () => {
  const view = rect(0, 0, 390, 740), top = { edge: 'top', rect: rect(14, 70, 362, 100) };
  const compact = markerPosition(view, [top, { edge: 'sheet', rect: rect(10, 470, 370, 258) }]);
  const expanded = markerPosition(view, [top, { edge: 'sheet', rect: rect(10, 350, 370, 378) }]);
  assert.ok(expanded.y < compact.y);
  assert.ok(expanded.y + 24 < 350);
  assert.ok(compact.y + 24 < 470);
});

test('route bounds share the visible padding; full overlays never produce negative map dimensions', () => {
  const camera = mapViewport(393, 700, { top: 180, right: 32, bottom: 360, left: 32 });
  assert.deepEqual(camera.paddingTopLeft, [32, 180]);
  assert.deepEqual(camera.paddingBottomRight, [32, 360]);
  const tiny = mapViewport(320, 240, { top: 200, right: 260, bottom: 350, left: 180 });
  assert.ok(tiny.paddingTopLeft[1] + tiny.paddingBottomRight[1] <= 176.001);
  assert.ok(tiny.paddingTopLeft[0] + tiny.paddingBottomRight[0] <= 256.001);
  assert.ok(tiny.centerOffset.every(Number.isFinite));
});

test('tablet navigation keeps the vehicle clear of the assignment panel and status dock', () => {
  const view = rect(166, 0, 1114, 800), panel = rect(182, 104, 371, 588), dock = rect(182, 708, 1082, 76);
  const marker = markerPosition(view, [{edge:'top',rect:rect(166,0,1114,88)}, {edge:'top',rect:rect(585,110,610,90)}, {edge:'sheet',rect:panel}, {edge:'bottom',rect:dock}]);
  assert.ok(marker.x - 24 > panel.right);
  assert.ok(marker.y - 24 > 200);
  assert.ok(marker.y + 24 < dock.top);
});

test('compact tablet keeps the whole marker visible between the controls at 900 by 500', () => {
  const view = rect(112, 0, 788, 500), panel = rect(128, 84, 280, 328), dock = rect(128, 426, 756, 64);
  const marker = markerPosition(view, [{edge:'top',rect:rect(0,0,900,72)}, {edge:'top',rect:rect(440,84,376,98)}, {edge:'sheet',rect:panel}, {edge:'bottom',rect:dock}]);
  assert.ok(marker.x - 24 > panel.right);
  assert.ok(marker.y - 24 > 182);
  assert.ok(marker.y + 24 < dock.top);
});

test('phone overview leaves a visible location between guidance and compact controls', () => {
  const view = rect(0, 0, 375, 582), guidance = rect(14, 80, 347, 100), sheet = rect(10, 326, 355, 244);
  const marker = markerPosition(view, [{edge:'top',rect:guidance}, {edge:'sheet',rect:sheet}]);
  assert.ok(marker.y - 24 > guidance.bottom);
  assert.ok(marker.y + 24 < sheet.top);
});
