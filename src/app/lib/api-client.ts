type FailureKind = 'api' | 'hosting' | 'timeout' | 'network';

export class ApiError extends Error {
  status: number;
  kind: FailureKind;
  retryAfterMs: number;
  constructor(message: string, status: number, kind: FailureKind = 'api', retryAfterMs = 0) {
    super(message); this.name = 'ApiError'; this.status = status; this.kind = kind; this.retryAfterMs = retryAfterMs;
  }
}

export function retryAfterMilliseconds(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const delay = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

function transportError(error: unknown, read: boolean) {
  const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
  return new ApiError(read
    ? timeout ? 'The service is taking longer to respond. It may be starting up; the app will reconnect automatically.' : 'Cannot reach the shared service. The app will reconnect automatically.'
    : 'The request could not be confirmed. Check the latest data before trying again.',
  0, timeout ? 'timeout' : 'network');
}

// Writes are sent once. Replaying an unconfirmed broadcast could create duplicate alerts.
export async function api(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const read = ['GET', 'HEAD'].includes(method.toUpperCase());
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: 'include', cache: 'no-store',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(read ? 65000 : 20000) });
  } catch (error) { throw transportError(error, read); }
  let raw: string;
  try { raw = await response.text(); } catch (error) { throw transportError(error, read); }
  let data: any;
  try { data = JSON.parse(raw); } catch { /* A host's HTML response is not an application response. */ }
  const retryAfterMs = retryAfterMilliseconds(response.headers.get('retry-after'));
  if (data === null || typeof data !== 'object') {
    const message = response.status === 429
      ? 'The hosting service is limiting connections. Waiting before reconnecting.'
      : 'The hosting service has not returned application data. The app will reconnect automatically.';
    throw new ApiError(message, response.ok ? 502 : response.status, 'hosting', retryAfterMs);
  }
  if (!response.ok) throw new ApiError(typeof data.error === 'string' ? data.error : 'The request could not be completed.', response.status, 'api', retryAfterMs);
  return data;
}

export class ReadReconnect {
  failures = 0;
  nextAt = 0;
  canRequest(now = Date.now()) { return now >= this.nextAt; }
  reset() { this.failures = 0; this.nextAt = 0; }
  failed(error: unknown, now = Date.now()) {
    this.failures++;
    const exponential = Math.min(60000, 5000 * 2 ** Math.min(this.failures - 1, 4));
    const serverWait = error instanceof ApiError ? error.retryAfterMs : 0;
    const minimum = error instanceof ApiError && error.status === 429 ? 30000 : 0;
    this.nextAt = now + Math.max(exponential, minimum, serverWait);
    return this.nextAt;
  }
}

export function connectionLabel(connection: string) {
  return ({ connected: 'Connected', connecting: 'Connecting…', offline: 'Device offline', unavailable: 'Reconnecting…' })[connection] || 'Connecting…';
}
