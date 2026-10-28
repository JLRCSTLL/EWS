import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobilePresentation, mobilePresentationReducer as reduce, mobilePresentationHelpNote, mobilePresentationLocation } from '../src/app/lib/presentation-mobile.ts';

test('phone delivery is not marked read until the sample alert is opened and acknowledged', () => {
  const original = createMobilePresentation('mobile-alert');
  assert.equal(reduce(original, { type: 'acknowledge' }), original);
  const opened = reduce(original, { type: 'open-alert' });
  assert.equal(opened.page, 'alerts');
  assert.equal(opened.acknowledged, false);
  const read = reduce(opened, { type: 'acknowledge' });
  assert.equal(read.acknowledged, true);
  assert.equal(reduce(read, { type: 'navigate', page: 'account' }).acknowledged, true);
  assert.equal(original.acknowledged, false);
  assert.equal(createMobilePresentation('mobile-alert').acknowledged, false);
});

test('mobile assistance flows from draft to the operator and team assignment returns to the phone', () => {
  const original = createMobilePresentation('mobile-help');
  assert.equal(reduce(original, { type: 'assign-team' }), original);
  assert.equal(reduce(original, { type: 'send-request' }), original);
  let state = reduce(original, { type: 'share-location' });
  state = reduce(state, { type: 'edit-request', field: 'assistance', value: 'Evacuation' });
  state = reduce(state, { type: 'edit-request', field: 'people', value: '2' });
  state = reduce(state, { type: 'edit-request', field: 'note', value: mobilePresentationHelpNote });
  state = reduce(state, { type: 'send-request' });
  assert.deepEqual(state.request, { status: 'new', type: 'Evacuation', people: 2, note: mobilePresentationHelpNote, location: mobilePresentationLocation });
  assert.equal(reduce(state, { type: 'send-request' }), state);
  const assigned = reduce(state, { type: 'assign-team' });
  assert.equal(assigned.request.status, 'assigned');
  assert.equal(state.request.status, 'new');
  assert.equal(original.request, null);
  assert.equal(original.sharing, false);
  assert.equal(createMobilePresentation('mobile-help').request, null);
});

test('a sample request never invents location consent and keeps draft values within bounds', () => {
  let state = createMobilePresentation('mobile-help');
  for (const value of ['0','21','NaN','1.5','']) assert.equal(reduce(state, { type: 'edit-request', field: 'people', value }), state);
  state = reduce(state, { type: 'edit-request', field: 'note', value: 'x'.repeat(600) });
  assert.equal(state.note.length, 500);
  state = reduce(state, { type: 'send-request' });
  assert.equal(state.request.location, null);
  assert.equal(reduce(state, { type: 'edit-request', field: 'note', value: 'changed' }), state);
});
