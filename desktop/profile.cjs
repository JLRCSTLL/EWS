'use strict';
const fs = require('node:fs');
const path = require('node:path');

function contained(root, target) {
  const relative = path.relative(root, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid profile path');
  return path.resolve(target);
}

// Discover one older command-center profile by its structure, without keeping a
// discontinued brand in the application. Never overwrite or remove its data.
function prepareProfile(appData) {
  const root = fs.realpathSync(appData);
  const directory = contained(root, path.join(root, 'AGILA Command Center'));
  if (fs.existsSync(directory)) return { directory, imported: false };
  const candidates = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/ Command Center$/.test(entry.name) || entry.name === 'AGILA Command Center') continue;
    const source = contained(root, path.join(root, entry.name));
    try {
      const preferences = path.join(source, 'window.json');
      if (!fs.lstatSync(preferences).isFile()) continue;
      const saved = JSON.parse(fs.readFileSync(preferences, 'utf8'));
      if (!Number.isFinite(saved.width) || !Number.isFinite(saved.height)) continue;
      const partitions = fs.readdirSync(path.join(source, 'Partitions'), { withFileTypes: true })
        .filter(part => part.isDirectory() && /^[a-z0-9-]+-command$/.test(part.name));
      if (partitions.length === 1) candidates.push({ source, partition: partitions[0].name });
    } catch { /* Unrelated or incomplete folders are not migration candidates. */ }
  }
  if (candidates.length !== 1) return { directory, imported: false };
  const staging = contained(root, fs.mkdtempSync(path.join(root, '.agila-profile-')));
  const { source, partition } = candidates[0];
  fs.cpSync(source, staging, { recursive: true, force: false, errorOnExist: true,
    filter: file => !fs.lstatSync(file).isSymbolicLink() && !['Cache', 'Code Cache', 'GPUCache', 'SingletonLock', 'SingletonSocket', 'SingletonCookie'].includes(path.basename(file)) });
  const oldPartition = contained(staging, path.join(staging, 'Partitions', partition));
  const newPartition = contained(staging, path.join(staging, 'Partitions', 'agila-command'));
  if (oldPartition !== newPartition) fs.renameSync(oldPartition, newPartition);
  fs.writeFileSync(path.join(staging, 'profile-migration.json'), JSON.stringify({ imported: true, version: 1, at: new Date().toISOString() }));
  // Both paths were resolved under appData; publish only after the copy finishes.
  fs.renameSync(staging, directory);
  return { directory, imported: true };
}

module.exports = { prepareProfile };
