import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationSteps, presentationArea, presentationMessage, tourStepIndex, tourCardPosition, tourCueAt, tourStepDuration, tourMoveDuration, tourTypingInterval } from '../src/app/lib/presentation-tour.ts';

test('the presentation follows the full alert workflow and navigation stays within the tour', () => {
  assert.deepEqual(presentationSteps.map(step => step.id), ['welcome', 'map', 'geofence', 'population', 'groups', 'exposure', 'message', 'responders', 'cctv', 'complete']);
  assert.equal(tourStepIndex(0, 'back'), 0);
  assert.equal(tourStepIndex(presentationSteps.length - 1, 'next'), presentationSteps.length - 1);
  assert.equal(tourStepIndex(6, 'back'), 5);
  assert.equal(tourStepIndex(6, 'next'), 7);
  assert.equal(tourStepIndex(6, 'restart'), 0);
});

test('presentation cards avoid targets when space is available and remain inside the viewport', () => {
  const viewport = { width: 1280, height: 720 };
  const card = { width: 350, height: 390 };
  const rightTarget = { left: 970, right: 1255, top: 95, bottom: 400 };
  const left = tourCardPosition(rightTarget, viewport, card);
  assert.ok(left.left + card.width < rightTarget.left);
  const leftTarget = { left: 20, right: 300, top: 95, bottom: 680 };
  const right = tourCardPosition(leftTarget, viewport, card);
  assert.ok(right.left > leftTarget.right);
  for (const target of [null, rightTarget, leftTarget, { left: 10, right: 1260, top: 10, bottom: 710 }]) {
    const position = tourCardPosition(target, viewport, card);
    assert.ok(position.left >= 18 && position.top >= 18);
    assert.ok(position.left + card.width <= viewport.width - 18);
    assert.ok(position.top + card.height <= viewport.height - 18);
  }
  const mobile = tourCardPosition(leftTarget, { width: 390, height: 844 }, card);
  assert.equal(mobile.left, 18);
  assert.equal(mobile.top, 844 - card.height - 18);
});

test('every automated action has time to move, type, and show the result before advancing', () => {
  presentationSteps.forEach((step, index) => {
    let elapsed = 0;
    step.cues.forEach((cue, cueIndex) => {
      assert.equal(tourCueAt(index, elapsed).index, cueIndex);
      assert.equal(tourCueAt(index, elapsed + cue.duration - 1).index, cueIndex);
      assert.ok(cue.duration > tourMoveDuration + 400);
      if (cue.kind === 'type') assert.ok(cue.duration > tourMoveDuration + cue.value.length * tourTypingInterval + 300);
      elapsed += cue.duration;
    });
    assert.equal(tourStepDuration(index), elapsed);
  });
});

test('the demo draws a complete valid sample boundary and types a clearly marked alert', () => {
  const drawn = presentationSteps.find(step => step.id === 'geofence').cues.filter(cue => cue.kind === 'map-point').map(cue => cue.point);
  assert.deepEqual(drawn, presentationArea.points);
  assert.ok(presentationMessage.startsWith('DEMO ALERT:'));
  assert.ok(presentationMessage.length <= 500);
  assert.ok(presentationSteps.find(step => step.id === 'message').cues.some(cue => cue.target === '.ops-tour-delivery'));
});
