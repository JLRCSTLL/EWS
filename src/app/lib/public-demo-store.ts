import { useMemo, useSyncExternalStore } from 'react';
import { COMMAND_MESSAGES_KEY, PUBLIC_DEMO_EVENT, PUBLIC_DEMO_KEY, parsePublicState, type PublicDemoState } from './public-demo';
import type { DashboardMessage } from './dashboard-data';

export function readDemoStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (!event.key || event.key === PUBLIC_DEMO_KEY || event.key === COMMAND_MESSAGES_KEY) listener(); };
  window.addEventListener('storage', storage);
  window.addEventListener(PUBLIC_DEMO_EVENT, listener);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(PUBLIC_DEMO_EVENT, listener); };
}
export function notifyDemoUpdate() { window.dispatchEvent(new Event(PUBLIC_DEMO_EVENT)); }
export function mutatePublicState(update: (current: PublicDemoState) => PublicDemoState) {
  const next = update(parsePublicState(readDemoStorage(PUBLIC_DEMO_KEY)));
  localStorage.setItem(PUBLIC_DEMO_KEY, JSON.stringify(next));
  notifyDemoUpdate();
}
export function usePublicDemo() {
  const raw = useSyncExternalStore(subscribe, () => readDemoStorage(PUBLIC_DEMO_KEY), () => null);
  return useMemo(() => parsePublicState(raw), [raw]);
}
export function useCommandMessages() {
  const raw = useSyncExternalStore(subscribe, () => readDemoStorage(COMMAND_MESSAGES_KEY), () => null);
  return useMemo((): DashboardMessage[] => { try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }, [raw]);
}
