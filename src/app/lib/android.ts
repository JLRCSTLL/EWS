export interface AndroidStatus {
  enabled: boolean; maxVolume: boolean; pushConfigured: boolean; notifications: boolean;
  dndAccess: boolean; dndBypass: boolean; alarmVolume: number; alarmMax: number;
  appVersion?: string; enhancedAlarms?: boolean; volumeFixed?: boolean;
  dndMode?: 'off' | 'alarms' | 'priority' | 'total-silence' | 'unknown'; dndAlarmsAllowed?: boolean | null;
  alarmState?: 'idle' | 'starting' | 'playing' | 'paused' | 'blocked' | 'finished' | 'announcement';
  alarmMessage?: string; alarmId?: string;
}
export interface AndroidLocationStatus {
  supported: boolean; sharing: boolean; permission: boolean; gpsEnabled: boolean;
  lastSentAt: string | null; message: string;
}
type NativeBridge = { postMessage: (message: string) => void; onmessage: ((event: MessageEvent) => void) | null };
declare global { interface Window { ELigtasAndroid?: NativeBridge } }
export const isAndroidApp = () => !!window.ELigtasAndroid;
let nextId = 0, attached: NativeBridge | undefined;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
export function android<T = AndroidStatus>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const bridge = window.ELigtasAndroid;
  if (!bridge) return Promise.reject(new Error('Open the E-Ligtas Android app to use this setting.'));
  if (attached !== bridge) {
    attached = bridge;
    bridge.onmessage = event => {
      try {
        const result = JSON.parse(event.data), waiting = pending.get(result.requestId);
        if (!waiting) return;
        pending.delete(result.requestId); clearTimeout(waiting.timer);
        if (result.error) waiting.reject(new Error(result.error)); else waiting.resolve(result.data);
      } catch { /* Ignore malformed bridge responses. */ }
    };
  }
  return new Promise((resolve, reject) => {
    const requestId = ++nextId;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Android did not respond. Please try again.')); }, action === 'locationPermission' ? 120000 : 15000);
    pending.set(requestId, { resolve, reject, timer });
    bridge.postMessage(JSON.stringify({ requestId, action, ...values }));
  });
}

export async function prepareAndroidLocation(userId: string) {
  const upgrade = 'This Android app needs an update to share live locations. Install E-Ligtas Android pilot 0.2.0 or newer, then reopen the app.';
  let status: AndroidLocationStatus;
  try { status = await android<AndroidLocationStatus>('locationStatus', { userId }); }
  catch (error) {
    if (error instanceof Error && error.message === 'Unsupported Android action.') throw new Error(upgrade);
    throw error;
  }
  if (!status?.supported) throw new Error(upgrade);
  await android('locationPermission');
}
