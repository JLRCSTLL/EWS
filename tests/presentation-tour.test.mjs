import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationSteps, presentationArea, presentationMessage, tourStepIndex, tourCardPosition, tourCueAt, tourStepDuration, tourMoveDuration, tourTypingInterval } from '../src/app/lib/presentation-tour.ts';
import { createPresentationState, changePresentationGroup } from '../src/app/lib/presentation-data.ts';
import { canUseWebDemo } from '../src/app/lib/presentation-platform.ts';

test('the presentation follows the full alert workflow and navigation stays within the tour', () => {
  assert.deepEqual(presentationSteps.map(step => step.id), ['welcome', 'profile', 'teams', 'map', 'geofence', 'population', 'audience', 'exposure', 'message', 'mobile-alert', 'mobile-help', 'mobile-responder', 'mobile-evacuation', 'responders', 'cctv', 'logs', 'complete']);
  assert.equal(tourStepIndex(0, 'back'), 0);
  assert.equal(tourStepIndex(presentationSteps.length - 1, 'next'), 0);
  assert.equal(tourStepIndex(6, 'back'), 5);
  assert.equal(tourStepIndex(6, 'next'), 7);
  assert.equal(tourStepIndex(6, 'restart'), 0);
});

test('continuous playback traverses every chapter again and desktop clients cannot enter a demo', () => {
  let index = 0;
  const visited = [];
  for (let i = 0; i < presentationSteps.length * 3; i++) {
    visited.push(index);
    index = tourStepIndex(index, 'next');
  }
  assert.equal(index, 0);
  assert.deepEqual(visited.slice(presentationSteps.length, presentationSteps.length * 2), visited.slice(0, presentationSteps.length));
  assert.equal(canUseWebDemo('Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36'), true);
  assert.equal(canUseWebDemo('Mozilla/5.0 (iPhone) Version/27.0 Mobile Safari/605.1.15'), true);
  assert.equal(canUseWebDemo('Mozilla/5.0 tanoviq-command-center/1.1.2 Chrome/149.0.0.0 Electron/45.0.0 Safari/537.36'), false);
  assert.equal(canUseWebDemo('Mozilla/5.0 TANOVIQDesktop/2.0'), false);
});

test('presentation groups are isolated, add leaders, and include members outside a geofence', () => {
  const original = createPresentationState();
  const created = changePresentationGroup(original, '/groups', { name:'Flood response',tag:'flood-response',headId:'demo-alex' }, 'POST');
  assert.equal(original.teamGroups.length,0);
  assert.equal(original.memberships.length,0);
  const id = created.result.id;
  assert.equal(created.state.memberships[0].is_leader,true);
  const added = changePresentationGroup(created.state, `/groups/${id}/members`,{userIds:['demo-sam','demo-kai','demo-sam']},'PUT');
  assert.equal(added.state.memberships.length,3);
  assert.equal(added.state.users.find(p=>p.id==='demo-kai').location,null);
  assert.equal(added.state.users.find(p=>p.id==='demo-sam').location.lng,121.04);
  const changed = changePresentationGroup(added.state,`/groups/${id}/members/demo-sam`,{isLeader:true},'PUT');
  assert.equal(changed.state.memberships.filter(m=>m.is_leader).length,2);
  assert.equal(changed.state.users.find(p=>p.id==='demo-sam').role,'resident');
  assert.equal(createPresentationState().teamGroups.length,0);
});

test('presentation mutations reject live actions and unknown personnel', () => {
  const initial=createPresentationState();
  assert.throws(()=>changePresentationGroup(initial,'/alerts',{content:'must not send'},'POST'));
  assert.throws(()=>changePresentationGroup(initial,'/groups',{name:'Sample',tag:'sample',headId:'live-user'},'POST'));
  const created=changePresentationGroup(initial,'/groups',{name:'Sample',tag:'sample'},'POST');
  assert.throws(()=>changePresentationGroup(created.state,`/groups/${created.result.id}/members`,{userIds:['live-user']},'PUT'));
  assert.equal(created.state.memberships.length,0);
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
