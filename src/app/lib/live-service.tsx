import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveState } from './live-model';
import { android, isAndroidApp, prepareAndroidLocation, type AndroidLocationStatus } from './android';

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`/api${path}`, { method, credentials: 'include', cache: 'no-store',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  let data;
  try { data = await response.json(); } catch { throw new ApiError('The shared service is not available yet. Please try again shortly.', response.status); }
  if (!response.ok) throw new ApiError(data.error || 'The request could not be completed.', response.status);
  return data;
}
type Connection = 'connecting' | 'connected' | 'offline' | 'unavailable';
interface Service {
  state: LiveState | null; connection: Connection; error: string; initialized: boolean;
  refresh: () => Promise<void>; mutate: (path: string, body?: unknown, method?: string) => Promise<any>;
  logout: () => Promise<void>; locationStatus: string; sharingOnDevice: boolean;
  locationNow: string;
  startLocation: () => Promise<void>; stopLocation: () => Promise<void>;
  recoveryCode: string; setRecoveryCode: (code: string) => void;
}
const Context = createContext<Service>(null!);
export const useLive = () => useContext(Context);
const locationKey = (id: string) => `eligtas-location-consent-${id}`;
export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [sharingOnDevice, setSharing] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Location sharing is off');
  const [locationNow, setLocationNow] = useState(() => new Date().toISOString());
  const epoch = useRef(0), refreshing = useRef(false), locationEpoch = useRef(0);
  const pendingLocation = useRef<Promise<unknown> | null>(null);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const requestEpoch = epoch.current;
    try {
      const data = await api('/state' + (location.hash.startsWith('#/public') ? '?view=public' : ''));
      if (requestEpoch !== epoch.current) return;
      setState(data); setError(''); setConnection('connected');
    } catch (error) {
      if (requestEpoch !== epoch.current) return;
      if (error instanceof ApiError && error.status === 401) { setState(null); setConnection('connected'); setError(''); }
      else { setConnection(navigator.onLine ? 'unavailable' : 'offline'); setError(error instanceof Error ? error.message : 'Connection interrupted.'); }
    } finally { refreshing.current = false; setInitialized(true); }
  }, []);
  useEffect(() => {
    void refresh();
    const tick = () => { setLocationNow(new Date().toISOString()); if (!document.hidden) void refresh(); };
    let publicScope = location.hash.startsWith('#/public');
    const route = () => {
      const next = location.hash.startsWith('#/public');
      if (next !== publicScope) { publicScope = next; epoch.current++; refreshing.current = false; setState(null); setConnection('connecting'); void refresh(); }
    };
    const offline = () => setConnection('offline');
    const pushed = (event: MessageEvent) => { if (event.data?.type === 'ELIGTAS_ALERT') tick(); };
    const timer = window.setInterval(tick, 5000);
    window.addEventListener('online', tick); window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', tick); window.addEventListener('hashchange', route);
    navigator.serviceWorker?.addEventListener('message', pushed); window.addEventListener('eligtas-native-alert', tick);
    return () => { clearInterval(timer); window.removeEventListener('online', tick); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', tick); window.removeEventListener('hashchange', route); navigator.serviceWorker?.removeEventListener('message', pushed); window.removeEventListener('eligtas-native-alert', tick); };
  }, [refresh]);
  const mutate = useCallback(async (path: string, body?: unknown, method?: string) => {
    const result = await api(path, body, method); await refresh(); return result;
  }, [refresh]);
  const userId = state?.user.id;
  useEffect(() => {
    if (!userId || !('EventSource' in window)) return;
    let stream: EventSource | undefined;
    const open = () => {
      stream?.close();
      if (document.hidden) return;
      stream = new EventSource('/api/location/events' + (location.hash.startsWith('#/public') ? '?view=public' : ''));
      stream.addEventListener('location', () => void refresh());
      stream.addEventListener('ready', () => void refresh());
    };
    open(); window.addEventListener('hashchange',open); document.addEventListener('visibilitychange',open);
    return () => { stream?.close(); window.removeEventListener('hashchange',open); document.removeEventListener('visibilitychange',open); };
  }, [userId,refresh]);
  useEffect(() => { if (initialized && connection === 'connected' && !userId && isAndroidApp()) void android('logout').catch(() => {}); }, [initialized,connection,userId]);
  useEffect(() => {
    if (!isAndroidApp()) { setSharing(!!userId && localStorage.getItem(locationKey(userId)) === 'yes'); return; }
    if (!userId) { setSharing(false); return; }
    let stopped = false;
    const check = async () => {
      try {
        const status = await android<AndroidLocationStatus>('locationStatus',{userId});
        if (!stopped) { setSharing(status.sharing); setLocationStatus(status.message); }
      } catch { if (!stopped) { setSharing(false); setLocationStatus('Install the latest Android pilot to enable continuous location sharing.'); } }
    };
    const changed = () => { void check(); void refresh(); };
    void check(); const timer = setInterval(() => { if (!document.hidden) void check(); },5000);
    window.addEventListener('eligtas-native-location',changed); window.addEventListener('focus',changed);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('eligtas-native-location',changed); window.removeEventListener('focus',changed); };
  }, [userId,refresh]);
  useEffect(() => {
    if (!sharingOnDevice || !userId || isAndroidApp()) return;
    if (!navigator.geolocation || !window.isSecureContext) { setLocationStatus('Location requires a secure HTTPS connection and a supported browser.'); setSharing(false); return; }
    let lastUpload = 0, stopped = false, sending = false;
    const generation = ++locationEpoch.current;
    setLocationStatus('Waiting for your device location…');
    const upload = async (position: GeolocationPosition) => {
      if (stopped || sending || document.hidden || Date.now() - lastUpload < 1000 || generation !== locationEpoch.current || Date.now() - position.timestamp > 10000) return;
      lastUpload = Date.now();
      sending = true;
      try {
        const request = api('/location', { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }, 'PUT');
        pendingLocation.current = request;
        await request;
        if (!stopped) { setLocationStatus(`Shared · accuracy ±${Math.round(position.coords.accuracy)} m`); await refresh(); }
      } catch { if (!stopped) setLocationStatus('Location not sent. Reconnecting…'); }
      finally { sending = false; pendingLocation.current = null; }
    };
    const failed = (event: GeolocationPositionError) => {
      if (stopped) return;
      setLocationStatus(event.code === 1 ? 'Location permission denied. Allow it in your browser settings, then try again.' : 'Unable to get a GPS fix. Try near a window or outdoors.');
      if (event.code === 1) { localStorage.removeItem(locationKey(userId)); setSharing(false); }
    };
    const options = { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 };
    const watch = navigator.geolocation.watchPosition(upload, failed, options);
    const timer = window.setInterval(() => { if (!document.hidden) navigator.geolocation.getCurrentPosition(upload, failed, options); }, 10000);
    return () => { stopped = true; navigator.geolocation.clearWatch(watch); clearInterval(timer); };
  }, [sharingOnDevice, userId, refresh]);
  const startLocation = async () => {
    if (!userId) return;
    if (!isAndroidApp()) { localStorage.setItem(locationKey(userId),'yes'); setSharing(true); return; }
    await prepareAndroidLocation(userId);
    const share = await api('/location/share',{});
    try {
      await android('locationStart',{userId,token:share.token});
      setSharing(true); setLocationStatus('Starting live location sharing…');
    } catch (error) { await api('/location',{},'DELETE').catch(() => {}); throw error; }
  };
  const stopLocation = async () => {
    locationEpoch.current++; setSharing(false);
    if (userId) localStorage.removeItem(locationKey(userId));
    try {
      if (isAndroidApp()) await android('locationStop');
      // Finish an upload already in flight before deleting its saved coordinates.
      await pendingLocation.current?.catch(() => {});
      await mutate('/location', {}, 'DELETE'); setLocationStatus('Location removed from the command-center map');
    }
    catch (error) { setLocationStatus('Sharing stopped on this device. Reconnect and tap Remove shared location to clear the last saved point.'); throw error; }
  };
  const logout = async () => {
    if (state?.user.locationSharing || sharingOnDevice) await stopLocation();
    if (isAndroidApp()) await android('logout');
    if ('serviceWorker' in navigator && !isAndroidApp()) {
      const worker = await navigator.serviceWorker.getRegistration();
      const sub = await worker?.pushManager.getSubscription();
      if (sub) { await api('/push', { endpoint: sub.endpoint }, 'DELETE'); await sub.unsubscribe(); }
    }
    await api('/auth/logout', {}); epoch.current++; setState(null); setSharing(false);
  };
  return <Context.Provider value={{ state, connection, error, initialized, refresh, mutate, logout, locationStatus, locationNow, sharingOnDevice, startLocation, stopLocation, recoveryCode, setRecoveryCode }}>{children}</Context.Provider>;
}
