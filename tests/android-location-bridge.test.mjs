import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAndroidLocation } from '../src/app/lib/android.ts';

test('Android location setup reports an old APK and respects the native permission result', async t => {
  const previous = globalThis.window;
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const actions = [];
  let response = () => ({});
  const bridge = {
    onmessage: null,
    postMessage(raw) {
      const request = JSON.parse(raw); actions.push(request.action);
      queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ requestId: request.requestId, ...response(request.action) }) }));
    },
  };
  globalThis.window = { ELigtasAndroid: bridge };
  response = () => ({ error: 'Unsupported Android action.' });
  await assert.rejects(prepareAndroidLocation('test-user'), /Install GSAM Android pilot 0\.2\.0/);
  assert.deepEqual(actions.splice(0), ['locationStatus']);

  response = action => action === 'locationStatus' ? { data: { supported: true } } : { error: 'Allow location access in Android app settings to share your location.' };
  await assert.rejects(prepareAndroidLocation('test-user'), /Allow location access/);
  assert.deepEqual(actions.splice(0), ['locationStatus', 'locationPermission']);

  response = action => ({ data: action === 'locationStatus' ? { supported: true } : { ready: true } });
  await prepareAndroidLocation('test-user');
  assert.deepEqual(actions, ['locationStatus', 'locationPermission']);
});
