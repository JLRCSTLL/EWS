// Move a known setting by its stable suffix when a previous app release used a
// different brand prefix. Preserve the value before removing the obsolete key.
export function readMigratedPreference(key: string, suffix: string, storage: Storage = localStorage) {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const candidates: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const candidate = storage.key(i);
    if (candidate && candidate !== key && candidate.endsWith(suffix) && /^[a-z]+-/.test(candidate)) candidates.push(candidate);
  }
  if (candidates.length !== 1) return null;
  const old = candidates[0], value = storage.getItem(old);
  if (value !== null) {
    storage.setItem(key, value);
    if (storage.getItem(key) === value) storage.removeItem(old);
  }
  return value;
}
