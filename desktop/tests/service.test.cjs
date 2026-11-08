const { test } = require('node:test');
const assert = require('node:assert/strict');
const { probeService } = require('../service.cjs');
test('desktop connectivity requires a real healthy API response', async () => {
  await assert.rejects(probeService(async () => new Response('<html>Starting</html>'), 'https://example.test/api/health'));
  await assert.rejects(probeService(async () => Response.json({ ok: false }), 'https://example.test/api/health'));
  await probeService(async () => Response.json({ ok: true }), 'https://example.test/api/health');
});
test('desktop rate limiting preserves the host retry delay', async () => {
  await assert.rejects(probeService(async () => new Response('Busy', { status: 429, headers: { 'Retry-After': '120' } }), 'https://example.test/api/health'), e => e.retryAfterMs === 120000);
});
