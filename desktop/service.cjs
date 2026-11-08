'use strict';
async function probeService(fetcher, url) {
  const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', redirect: 'error',
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(65000) });
  let data; try { data = await response.json(); } catch { /* Host loading pages are not health responses. */ }
  if (response.ok && data?.ok === true) return;
  const retry = response.headers.get('retry-after');
  const delay = retry && /^\d+$/.test(retry.trim()) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 0;
  throw Object.assign(new Error('The shared service is not responding yet. Connection checks retry automatically.'), {
    retryAfterMs: Math.max(response.status === 429 ? 30000 : 0, Number.isFinite(delay) ? delay : 0),
  });
}
module.exports = { probeService };
