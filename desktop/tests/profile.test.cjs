const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareProfile } = require('../profile.cjs');

function fixture(t) {
  const root = fs.realpathSync(os.tmpdir());
  const folder = fs.mkdtempSync(path.join(root, 'agila-profile-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(folder)), root);
    assert.ok(path.basename(folder).startsWith('agila-profile-test-'));
    fs.rmSync(folder, { recursive: true, force: true });
  });
  return folder;
}
function older(root, name = 'Previous Command Center') {
  const folder = path.join(root, name);
  fs.mkdirSync(path.join(folder, 'Partitions', 'previous-command', 'Local Storage'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'window.json'), JSON.stringify({ width: 1440, height: 900, maximized: true }));
  fs.writeFileSync(path.join(folder, 'Partitions', 'previous-command', 'Local Storage', 'saved-areas'), 'saved-geofences');
  return folder;
}
test('upgrade copies saved data into the AGILA profile and preserves the previous copy', t => {
  const root = fixture(t), previous = older(root);
  fs.mkdirSync(path.join(previous, 'Cache')); fs.writeFileSync(path.join(previous, 'Cache', 'old'), 'obsolete');
  const result = prepareProfile(root);
  assert.equal(result.imported, true);
  assert.equal(fs.readFileSync(path.join(result.directory, 'Partitions', 'agila-command', 'Local Storage', 'saved-areas'), 'utf8'), 'saved-geofences');
  assert.equal(fs.existsSync(previous), true);
  assert.equal(fs.existsSync(path.join(result.directory, 'Cache')), false);
});
test('existing AGILA settings are never overwritten by an old profile', t => {
  const root = fixture(t); older(root);
  const current = path.join(root, 'AGILA Command Center'); fs.mkdirSync(current);
  fs.writeFileSync(path.join(current, 'window.json'), 'current');
  assert.equal(prepareProfile(root).imported, false);
  assert.equal(fs.readFileSync(path.join(current, 'window.json'), 'utf8'), 'current');
});
test('ambiguous profiles are left untouched', t => {
  const root = fixture(t); older(root); older(root, 'Another Command Center');
  const result = prepareProfile(root);
  assert.equal(result.imported, false); assert.equal(fs.existsSync(result.directory), false);
});
test('unrelated directories do not qualify as a previous installation', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, 'Other Command Center'));
  assert.equal(prepareProfile(root).imported, false);
});
